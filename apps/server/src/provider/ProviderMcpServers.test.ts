import {
  ProviderInstanceId,
  ProviderSessionId,
  ProviderThreadId,
  ThreadId,
  type OrchestrationV2ProviderThread,
} from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as ProviderSessionManager from "../orchestration-v2/ProviderSessionManager.ts";
import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import * as ProviderMcpServers from "./ProviderMcpServers.ts";

const instanceId = ProviderInstanceId.make("claude");
const providerSessionId = ProviderSessionId.make("provider-session");
const olderThread = ThreadId.make("thread-older");
const newerThread = ThreadId.make("thread-newer");

const providerThreadFor = (threadId: ThreadId) =>
  ({
    id: ProviderThreadId.make(`provider-${threadId}`),
    appThreadId: threadId,
    providerSessionId,
  }) as OrchestrationV2ProviderThread;

const listed: Array<ThreadId | null> = [];

function makeLayer(input: {
  readonly live: boolean;
  readonly mcpServers?: ProviderAdapter.ProviderAdapterV2McpServers;
}) {
  const runtime = {
    instanceId,
    providerSessionId,
    ...(input.mcpServers === undefined ? {} : { mcpServers: input.mcpServers }),
  } as ProviderAdapter.ProviderAdapterV2SessionRuntime;
  return ProviderMcpServers.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.mock(ThreadManagementService.ThreadManagementService)({
          getThreadRecords: (threadId: ThreadId) =>
            Effect.succeed({
              thread: {
                title: threadId === newerThread ? "Newer chat" : "Older chat",
                providerInstanceId: instanceId,
                activeProviderThreadId: providerThreadFor(threadId).id,
                updatedAt: DateTime.makeUnsafe(threadId === newerThread ? 2_000 : 1_000),
              },
              providerThreads: [providerThreadFor(threadId)],
            } as never),
        }),
        Layer.mock(ProviderSessionManager.ProviderSessionManagerV2)({
          get: () => Effect.succeed(input.live ? Option.some(runtime) : Option.none()),
          liveSessionsForInstance: () =>
            Effect.succeed(input.live ? [{ runtime, threadIds: [olderThread, newerThread] }] : []),
        }),
      ),
    ),
  );
}

const servers: ProviderAdapter.ProviderAdapterV2McpServers = {
  list: ({ providerThread }) =>
    Effect.sync(() => {
      listed.push(providerThread.appThreadId);
      return { profile: "/profiles/home", servers: [] };
    }),
};

describe("ProviderMcpServers", () => {
  it.effect("reports no session without starting one", () =>
    Effect.gen(function* () {
      const service = yield* ProviderMcpServers.ProviderMcpServers;
      assert.deepStrictEqual(yield* service.list({ threadId: olderThread }), {
        _tag: "no-session",
        instanceId,
      });
      assert.deepStrictEqual(yield* service.list({ instanceId }), {
        _tag: "no-session",
        instanceId,
      });
    }).pipe(Effect.provide(makeLayer({ live: false, mcpServers: servers }))),
  );

  it.effect("reports providers that cannot list their servers", () =>
    Effect.gen(function* () {
      const service = yield* ProviderMcpServers.ProviderMcpServers;
      assert.deepStrictEqual(yield* service.list({ threadId: olderThread }), {
        _tag: "unsupported",
        instanceId,
      });
    }).pipe(Effect.provide(makeLayer({ live: true }))),
  );

  it.effect("lists an instance's servers from its most recently updated running chat", () =>
    Effect.gen(function* () {
      listed.length = 0;
      const service = yield* ProviderMcpServers.ProviderMcpServers;
      const listing = yield* service.list({ instanceId });
      assert.strictEqual(listing._tag, "servers");
      if (listing._tag !== "servers") return;
      assert.strictEqual(listing.threadId, newerThread);
      assert.strictEqual(listing.threadTitle, "Newer chat");
      assert.strictEqual(listing.profile, "/profiles/home");
      assert.deepStrictEqual(listed, [newerThread]);
    }).pipe(Effect.provide(makeLayer({ live: true, mcpServers: servers }))),
  );

  it.effect("treats an adapter without a live process as no session", () =>
    Effect.gen(function* () {
      const service = yield* ProviderMcpServers.ProviderMcpServers;
      assert.deepStrictEqual(yield* service.list({ threadId: olderThread }), {
        _tag: "no-session",
        instanceId,
      });
    }).pipe(
      Effect.provide(makeLayer({ live: true, mcpServers: { list: () => Effect.succeed(null) } })),
    ),
  );
});
