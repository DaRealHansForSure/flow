import type { DesktopBackgroundModeState, DesktopBridge } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Atom } from "effect/reactivity";

// Flow: the mode is fixed for a launch (a switch relaunches the app), so one read is enough.

type DesktopBackgroundModeBridge = Pick<DesktopBridge, "getBackgroundMode">;

class DesktopBackgroundModeUnavailableError extends Schema.TaggedError<DesktopBackgroundModeUnavailableError>()(
  "DesktopBackgroundModeUnavailableError",
  {},
) {
  override get message(): string {
    return "The background mode is unavailable in this app.";
  }
}

class DesktopBackgroundModeLoadError extends Schema.TaggedError<DesktopBackgroundModeLoadError>()(
  "DesktopBackgroundModeLoadError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Failed to read the background mode.";
  }
}

function getDesktopBackgroundModeBridge(): DesktopBackgroundModeBridge | undefined {
  return typeof window === "undefined" ? undefined : window.desktopBridge;
}

const loadDesktopBackgroundMode = Effect.fn("loadDesktopBackgroundMode")(function* () {
  const getMode = getDesktopBackgroundModeBridge()?.getBackgroundMode;
  if (!getMode) {
    return yield* new DesktopBackgroundModeUnavailableError();
  }
  return yield* Effect.tryPromise({
    try: (): Promise<DesktopBackgroundModeState> => getMode(),
    catch: (cause) => new DesktopBackgroundModeLoadError({ cause }),
  });
});

export const desktopBackgroundModeAtom = Atom.make(loadDesktopBackgroundMode()).pipe(
  Atom.keepAlive,
  Atom.withLabel("desktop:background-mode:load"),
);
