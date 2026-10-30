import {
  ProviderMcpListError,
  type OrchestrationV2ProviderThread,
  type ProviderInstanceId,
  type ProviderMcpListInput,
  type ProviderMcpListing,
  type ThreadId,
} from "@t3tools/contracts";
import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as ProviderSessionManager from "../orchestration-v2/ProviderSessionManager.ts";
import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";

/** Asks running sessions only; opening a session would start the user's MCP servers. */
export class ProviderMcpServers extends Context.Service<
  ProviderMcpServers,
  {
    readonly list: (
      input: ProviderMcpListInput,
    ) => Effect.Effect<ProviderMcpListing, ProviderMcpListError>;
  }
>()("t3/provider/ProviderMcpServers") {}

const requestFailed = (cause: unknown) =>
  new ProviderMcpListError({ reason: "request-failed", cause });

const make = Effect.gen(function* () {
  const threadManagement = yield* ThreadManagementService.ThreadManagementService;
  const providerSessions = yield* ProviderSessionManager.ProviderSessionManagerV2;

  const threadRecords = (threadId: ThreadId) =>
    threadManagement
      .getThreadRecords(threadId, ["providerThreads"])
      .pipe(
        Effect.mapError((cause) => new ProviderMcpListError({ reason: "thread-not-found", cause })),
      );

  const activeProviderThread = (
    records: Effect.Success<ReturnType<typeof threadRecords>>,
  ): OrchestrationV2ProviderThread | undefined =>
    records.providerThreads.find(
      (candidate) => candidate.id === records.thread.activeProviderThreadId,
    );

  const listFrom = Effect.fn("ProviderMcpServers.listFrom")(function* (input: {
    readonly runtime: ProviderAdapter.ProviderAdapterV2SessionRuntime;
    readonly providerThread: OrchestrationV2ProviderThread;
    readonly threadId: ThreadId;
    readonly threadTitle: string;
  }) {
    const instanceId = input.runtime.instanceId;
    if (input.runtime.mcpServers === undefined) {
      return { _tag: "unsupported", instanceId } satisfies ProviderMcpListing;
    }
    const listing = yield* input.runtime.mcpServers
      .list({ providerThread: input.providerThread })
      .pipe(Effect.mapError(requestFailed));
    if (listing === null) {
      return { _tag: "no-session", instanceId } satisfies ProviderMcpListing;
    }
    return {
      _tag: "servers",
      instanceId,
      threadId: input.threadId,
      threadTitle: input.threadTitle,
      ...(listing.profile === undefined ? {} : { profile: listing.profile }),
      checkedAt: DateTime.formatIso(yield* DateTime.now),
      servers: listing.servers,
    } satisfies ProviderMcpListing;
  });

  const listForThread = Effect.fn("ProviderMcpServers.listForThread")(function* (
    threadId: ThreadId,
  ) {
    const records = yield* threadRecords(threadId);
    const providerThread = activeProviderThread(records);
    const runtime =
      providerThread?.providerSessionId == null
        ? undefined
        : Option.getOrUndefined(
            yield* providerSessions
              .get(providerThread.providerSessionId)
              .pipe(Effect.mapError(requestFailed)),
          );
    if (providerThread === undefined || runtime === undefined) {
      return {
        _tag: "no-session",
        instanceId: records.thread.providerInstanceId,
      } satisfies ProviderMcpListing;
    }
    return yield* listFrom({
      runtime,
      providerThread,
      threadId,
      threadTitle: records.thread.title,
    });
  });

  const listForInstance = Effect.fn("ProviderMcpServers.listForInstance")(function* (
    instanceId: ProviderInstanceId,
  ) {
    const candidates: Array<{
      readonly runtime: ProviderAdapter.ProviderAdapterV2SessionRuntime;
      readonly providerThread: OrchestrationV2ProviderThread;
      readonly threadId: ThreadId;
      readonly threadTitle: string;
      readonly updatedAt: number;
    }> = [];
    for (const session of yield* providerSessions.liveSessionsForInstance(instanceId)) {
      for (const threadId of session.threadIds) {
        const records = yield* threadRecords(threadId).pipe(Effect.option);
        if (Option.isNone(records)) {
          continue;
        }
        const providerThread = activeProviderThread(records.value);
        if (providerThread?.providerSessionId !== session.runtime.providerSessionId) {
          continue;
        }
        candidates.push({
          runtime: session.runtime,
          providerThread,
          threadId,
          threadTitle: records.value.thread.title,
          updatedAt: DateTime.toEpochMillis(records.value.thread.updatedAt),
        });
      }
    }
    const latest = candidates.toSorted((left, right) => right.updatedAt - left.updatedAt)[0];
    if (latest === undefined) {
      return { _tag: "no-session", instanceId } satisfies ProviderMcpListing;
    }
    return yield* listFrom(latest);
  });

  const list = Effect.fn("ProviderMcpServers.list")(function* (input: ProviderMcpListInput) {
    return "threadId" in input
      ? yield* listForThread(input.threadId)
      : yield* listForInstance(input.instanceId);
  });

  return ProviderMcpServers.of({ list });
});

export const layer = Layer.effect(ProviderMcpServers, make);
