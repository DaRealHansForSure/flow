import {
  DesktopFlowServiceRecoveryResultSchema,
  DesktopFlowServiceUpdateSchema,
  type DesktopFlowServiceRecoveryResult,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DesktopServiceSync from "../../backend/DesktopServiceSync.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

// Flow: what the recovery screen reads and does while the app updates the
// service. Fails soft like the other recovery methods: that screen must render.

const failed = (detail: string): DesktopFlowServiceRecoveryResult => ({ ok: false, detail });
const succeeded: DesktopFlowServiceRecoveryResult = { ok: true, detail: null };

export const getFlowServiceUpdate = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.GET_FLOW_SERVICE_UPDATE_CHANNEL,
  payload: Schema.Void,
  result: Schema.NullOr(DesktopFlowServiceUpdateSchema),
  handler: Effect.fn("desktop.ipc.flowServiceUpdate.get")(function* () {
    const sync = yield* DesktopServiceSync.DesktopServiceSync;
    return yield* sync.current;
  }),
});

export const retryFlowServiceUpdate = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.RETRY_FLOW_SERVICE_UPDATE_CHANNEL,
  payload: Schema.Void,
  result: DesktopFlowServiceRecoveryResultSchema,
  handler: Effect.fn("desktop.ipc.flowServiceUpdate.retry")(function* () {
    const sync = yield* DesktopServiceSync.DesktopServiceSync;
    return yield* sync.retry.pipe(
      Effect.as(succeeded),
      Effect.catchCause((cause) => Effect.succeed(failed(Cause.pretty(cause)))),
    );
  }),
});

export const skipFlowServiceUpdate = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.SKIP_FLOW_SERVICE_UPDATE_CHANNEL,
  payload: Schema.Void,
  result: DesktopFlowServiceRecoveryResultSchema,
  handler: Effect.fn("desktop.ipc.flowServiceUpdate.skip")(function* () {
    const sync = yield* DesktopServiceSync.DesktopServiceSync;
    return yield* sync.skip.pipe(
      Effect.as(succeeded),
      Effect.catchCause((cause) => Effect.succeed(failed(Cause.pretty(cause)))),
    );
  }),
});
