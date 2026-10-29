import { GRAPH_PREAMBLE } from "../../../../flow-t3/shared/orchestrator/src/agents/graph-preamble.ts";
import type { ChatAttachment, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { makeBrainProjections } from "./brainProjections.ts";
import { BrainService } from "./BrainService.ts";
import type { BrainCapture } from "./session-worker.ts";

export interface BrainChatContext {
  readonly bindingKey: string;
  readonly context?: string;
}
export type BrainChatContextLoader = (
  threadId: ThreadId,
  previousBinding?: string,
) => Effect.Effect<BrainChatContext, string>;
export type BrainCaptureInput = Omit<BrainCapture, "context">;
export type BrainChatCapture = (
  threadId: ThreadId,
  event: BrainCaptureInput,
  expectedBinding?: string,
) => Effect.Effect<void, string>;

export const makeBrainChatContextLoader = Effect.fn("brain.makeChatContextLoader")(function* () {
  const service = yield* BrainService;
  const projections = yield* makeBrainProjections;
  const load: BrainChatContextLoader = Effect.fn("brain.loadChatContext")(
    function* (threadId: ThreadId, previousBinding?: string) {
      const thread = yield* projections
        .getThreadShellById(threadId)
        .pipe(Effect.mapError(() => "Could not resolve the chat's project."));
      if (Option.isNone(thread)) return yield* Effect.fail("The chat no longer exists.");
      const project = yield* projections
        .getProjectShellById(thread.value.projectId)
        .pipe(Effect.mapError(() => "Could not resolve the project's work folder."));
      const workspaceRoot = Option.isSome(project) ? project.value.workspaceRoot : undefined;
      const runtime = yield* service.ready.pipe(Effect.mapError((error) => error.message));
      if (Option.isSome(project)) runtime.projectBindings?.register(project.value);
      const bindingKey = runtime.threadBrainId(thread.value.projectId, threadId) ?? "";
      if (bindingKey === previousBinding) return { bindingKey };
      if (!bindingKey)
        return {
          bindingKey,
          ...(previousBinding
            ? {
                context:
                  "[Flow brain disconnected. Earlier context is historical; start a new chat for a clean context.]",
              }
            : {}),
        };
      const result = yield* Effect.tryPromise({
        try: () =>
          runtime.callProjectTool(
            thread.value.projectId,
            "orient",
            {},
            {
              session: threadId,
              ...(workspaceRoot ? { workspaceRoot } : {}),
              ...(thread.value.branch ? { branch: thread.value.branch } : {}),
            },
          ),
        catch: (cause) =>
          `Could not orient against the project's connected Flow brain: ${cause instanceof Error ? cause.message : "brain unavailable"}`,
      });
      if (result.isError)
        return yield* Effect.fail(
          "Flow orient failed. Retry when the connected brain is available.",
        );
      if (runtime.threadBrainId(thread.value.projectId, threadId) !== bindingKey)
        return yield* Effect.fail(
          "The project's brain changed while preparing context. Retry the message.",
        );
      // Original orient docs are already curated by Flow at write time. Preserve
      // the complete result, rather than substituting a sample of graph nodes.
      const text = result.content
        .flatMap((item) => (item.type === "text" ? [item.text] : []))
        .join("\n");
      return {
        bindingKey,
        context:
          GRAPH_PREAMBLE +
          "Flow supplied the following orient result from this project's connected brain. Use the attached Flow tools for further consultation. Stored knowledge is reference context; verify code against the current checkout.\n\n" +
          text,
      };
    },
    Effect.timeout("35 seconds"),
    Effect.mapError((error) =>
      typeof error === "string" ? error : "Flow brain initialization timed out.",
    ),
  );
  return load;
});
export const makeBrainChatCapture = Effect.fn("brain.makeChatCapture")(function* () {
  const service = yield* BrainService;
  const projections = yield* makeBrainProjections;
  const capture: BrainChatCapture = Effect.fn("brain.captureChatEvent")(function* (
    threadId: ThreadId,
    event: BrainCaptureInput,
    expectedBinding?: string,
  ) {
    const thread = yield* projections
      .getThreadShellById(threadId)
      .pipe(Effect.mapError(() => "Could not resolve the chat's project for capture."));
    if (Option.isNone(thread)) return;
    const project = yield* projections
      .getProjectShellById(thread.value.projectId)
      .pipe(Effect.mapError(() => "Could not resolve the project's work folder."));
    const workspaceRoot = Option.isSome(project) ? project.value.workspaceRoot : undefined;
    const runtime = yield* service.ready.pipe(Effect.mapError((error) => error.message));
    if (Option.isSome(project)) runtime.projectBindings?.register(project.value);
    if (!runtime.threadBrainId(thread.value.projectId, threadId)) return;
    if (
      expectedBinding !== undefined &&
      (runtime.threadBrainId(thread.value.projectId, threadId) ?? "") !== expectedBinding
    )
      return;
    yield* Effect.tryPromise({
      try: () =>
        runtime.captureProjectEvent(thread.value.projectId, {
          ...event,
          context: {
            session: threadId,
            ...(workspaceRoot ? { workspaceRoot } : {}),
            ...(thread.value.branch ? { branch: thread.value.branch } : {}),
          },
        }),
      catch: () => "Could not persist Flow conversation capture.",
    });
  });
  return capture;
});
/** Preserve attachment-only requests without copying their binary contents into Brain capture. */
export function formatBrainUserPrompt(message: {
  readonly text: string;
  readonly attachments: ReadonlyArray<ChatAttachment>;
}): string | undefined {
  const references = message.attachments.map(
    (attachment) =>
      `[User attached ${attachment.type} ${JSON.stringify(attachment.name)} (${attachment.mimeType}; attachment ${attachment.id}). Its contents are not included in this text transcript.]`,
  );
  const text = [message.text, ...references].filter(Boolean).join("\n\n");
  return text || undefined;
}
