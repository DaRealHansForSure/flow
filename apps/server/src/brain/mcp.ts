import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
// oxlint-disable-next-line t3code/no-raw-mcp-registration -- Brain tools are the Brain's runtime catalog, not a typed toolkit; the handler checks the "brain" capability.
import { McpSchema, McpServer } from "effect/ai";
import { McpInvocationContext } from "../mcp/McpInvocationContext.ts";
import { makeBrainProjections } from "./brainProjections.ts";
import { BrainService } from "./BrainService.ts";
import { ServerConfig } from "../config.ts";
import { isScratchWorkspace } from "./scratch.ts";
import { originalBrainTools } from "./session-worker.ts";
import { AnalyticsService } from "../telemetry/AnalyticsService.ts";

// Discover the original MCP's schemas, descriptions and annotations verbatim.
// The T3 boundary only authenticates the chat and resolves its selected brain.
// The chat's own notes are an ordinary document (orient names its id), so no
// chat-scoped tool is added here.
export const BrainToolkitRegistrationLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* McpServer.McpServer;
    const service = yield* BrainService;
    const projections = yield* makeBrainProjections;
    const analytics = yield* AnalyticsService;
    const { baseDir } = yield* ServerConfig;
    const tools = yield* Effect.promise(originalBrainTools);
    for (const tool of tools) {
      // oxlint-disable-next-line t3code/no-raw-mcp-registration -- See the import above.
      yield* registry.addTool({
        tool,
        annotations: Context.empty(),
        handle: Effect.fn("brain.mcpTool")(
          function* (args: Record<string, unknown>) {
            const scope = yield* Effect.serviceOption(McpInvocationContext);
            const session = Option.isSome(scope) ? scope.value.thread : undefined;
            if (
              session === undefined ||
              !scope.pipe(Option.exists((context) => context.capabilities.has("brain")))
            )
              return yield* Effect.fail("This session does not have Brain access.");
            const thread = yield* projections
              .getThreadShellById(session.threadId)
              .pipe(Effect.mapError(() => "Could not resolve the chat's project."));
            if (Option.isNone(thread)) return yield* Effect.fail("The chat no longer exists.");
            const project = yield* projections
              .getProjectShellById(thread.value.projectId)
              .pipe(Effect.mapError(() => "Could not resolve the project's work folder."));
            const workspaceRoot = Option.isSome(project) ? project.value.workspaceRoot : undefined;
            // Flow: No project chats only read their Brain; tools that write to it refuse them.
            if (
              tool.annotations?.readOnlyHint === false &&
              isScratchWorkspace(baseDir, workspaceRoot)
            )
              return yield* Effect.fail(
                "This chat has no project, so it can only read the Brain. Nothing was saved.",
              );
            const runtime = yield* service.ready.pipe(Effect.mapError((error) => error.message));
            if (Option.isSome(project)) runtime.projectBindings?.register(project.value);
            return yield* Effect.tryPromise({
              try: () =>
                runtime.callProjectTool(thread.value.projectId, tool.name, args, {
                  session: session.threadId,
                  ...(workspaceRoot ? { workspaceRoot } : {}),
                  ...(thread.value.branch ? { branch: thread.value.branch } : {}),
                }),
              catch: (error) =>
                error instanceof Error ? error.message : "The connected brain is unavailable.",
            });
          },
          Effect.tap(() =>
            analytics.record("brain.tool.completed", { tool: tool.name, success: true }),
          ),
          Effect.tapError(() =>
            analytics.record("brain.tool.completed", { tool: tool.name, success: false }),
          ),
          Effect.catch((error) =>
            Effect.succeed(
              new McpSchema.CallToolResult({
                isError: true,
                content: [{ type: "text", text: error }],
              }),
            ),
          ),
        ),
      });
    }
  }),
);
