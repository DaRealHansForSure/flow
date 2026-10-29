import { expect, it } from "@effect/vitest";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";
import { BrainService } from "./BrainService.ts";
import type { BrainRuntime } from "./BrainRuntime.ts";
import { BrainToolkitRegistrationLive } from "./mcp.ts";
import { McpInvocationContext } from "../mcp/McpInvocationContext.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as AnalyticsService from "../telemetry/AnalyticsService.ts";

const client = McpSchema.McpServerClient.of({
  clientId: 1,
  protocolVersion: "2025-06-18",
  clientCapabilities: {},
  clientInfo: { name: "brain-test", version: "1" },
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "brain-test", version: "1" },
  },
  getClient: Effect.die("unused"),
});
const thread = {
  threadId: ThreadId.make("thread-a"),
  providerSessionId: "session-a",
  providerInstanceId: ProviderInstanceId.make("claude"),
};
const scope = {
  environmentId: EnvironmentId.make("brain-test"),
  capabilities: new Set(["brain"] as const),
  issuedAt: 1,
  requestNamespace: "brain-test",
  thread,
  client: undefined,
};
const projectId = ProjectId.make("project-a");

it.effect(
  "MCP resolves the project from its authenticated thread and refuses a session without Brain access",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const readProjects: string[] = [];
        const analyticsEvents: Array<{
          event: string;
          properties?: Readonly<Record<string, unknown>>;
        }> = [];
        const runtime = {
          callProjectTool: async (id: ProjectId) => {
            readProjects.push(id);
            return { content: [{ type: "text", text: "Only project A's brain" }] };
          },
        } as unknown as BrainRuntime;
        const threads = {
          getThreadShell: (id: ThreadId) => {
            expect(id).toBe(thread.threadId);
            return Effect.succeed({ projectId });
          },
        } as unknown as ProjectionStore.ProjectionStoreV2["Service"];
        const projects = {
          getShell: () => Effect.succeedNone,
        } as unknown as ProjectStore.ProjectStoreV2["Service"];
        const layer = BrainToolkitRegistrationLive.pipe(
          Layer.provideMerge(McpServer.McpServer.layer),
          Layer.provideMerge(Layer.succeed(BrainService, { ready: Effect.succeed(runtime) })),
          Layer.provideMerge(Layer.succeed(ProjectionStore.ProjectionStoreV2, threads)),
          Layer.provideMerge(Layer.succeed(ProjectStore.ProjectStoreV2, projects)),
          Layer.provideMerge(
            Layer.succeed(
              AnalyticsService.AnalyticsService,
              AnalyticsService.AnalyticsService.of({
                record: (event, properties) =>
                  Effect.sync(() =>
                    analyticsEvents.push({
                      event,
                      ...(properties === undefined ? {} : { properties }),
                    }),
                  ),
                flush: Effect.void,
                recordOwners: () => Effect.void,
              }),
            ),
          ),
        );
        yield* Effect.gen(function* () {
          const server = yield* McpServer.McpServer;
          const result = yield* server
            .callTool({ name: "search_knowledge", arguments: { query: "architecture" } })
            .pipe(
              Effect.provideService(McpSchema.McpServerClient, client),
              Effect.provideService(McpInvocationContext, scope),
            );
          expect(result.isError).not.toBe(true);
          expect(readProjects).toEqual([projectId]);
          const denied = yield* server.callTool({ name: "search_knowledge", arguments: {} }).pipe(
            Effect.provideService(McpSchema.McpServerClient, client),
            Effect.provideService(McpInvocationContext, {
              ...scope,
              capabilities: new Set<"brain">(),
            }),
          );
          expect(denied.isError).toBe(true);
          expect(readProjects).toEqual([projectId]);
          expect(analyticsEvents).toEqual([
            {
              event: "brain.tool.completed",
              properties: { tool: "search_knowledge", success: true },
            },
            {
              event: "brain.tool.completed",
              properties: { tool: "search_knowledge", success: false },
            },
          ]);
        }).pipe(Effect.provide(layer));
      }),
    ),
);
