import {
  DesktopBackgroundModeStateSchema,
  DesktopFlowServiceRecoveryResultSchema,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as DesktopBackendPool from "../../backend/DesktopBackendPool.ts";
import * as DesktopBackgroundMode from "../../backend/DesktopBackgroundMode.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

// Flow: Settings > General > Keep Flow running in the background.

const OWN_SERVER_STOP_TIMEOUT = Duration.seconds(10);

export const getBackgroundMode = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.GET_BACKGROUND_MODE_CHANNEL,
  payload: Schema.Void,
  result: DesktopBackgroundModeStateSchema,
  handler: Effect.fn("desktop.ipc.backgroundMode.get")(function* () {
    const backgroundMode = yield* DesktopBackgroundMode.DesktopBackgroundMode;
    const current = yield* backgroundMode.current;
    return {
      activeMode: Option.match(current, { onNone: () => null, onSome: (value) => value.mode }),
      canSwitch: Option.exists(current, (value) => value.canSwitch),
    };
  }),
});

export const switchBackgroundMode = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.SWITCH_BACKGROUND_MODE_CHANNEL,
  payload: Schema.Boolean,
  result: DesktopFlowServiceRecoveryResultSchema,
  handler: Effect.fn("desktop.ipc.backgroundMode.switch")(function* (runInBackground) {
    const backgroundMode = yield* DesktopBackgroundMode.DesktopBackgroundMode;
    const pool = yield* DesktopBackendPool.DesktopBackendPool;
    return yield* backgroundMode
      .switchTo({
        runInBackground,
        stopOwnServer: pool.primary.pipe(
          Effect.flatMap((primary) => primary.stop({ timeout: OWN_SERVER_STOP_TIMEOUT })),
        ),
      })
      .pipe(
        Effect.catchCause((cause) => Effect.succeed({ ok: false, detail: Cause.pretty(cause) })),
      );
  }),
});
