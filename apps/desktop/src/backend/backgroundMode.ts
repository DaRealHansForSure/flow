// Flow: by default the app runs its own server, which ends when the app quits; the
// background service is opt-in (`runInBackground`). Decides once per launch which
// one the primary uses, and asks before stopping a service that holds the data home.

import type { DesktopFlowServiceActionResult } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type { FlowServicePresence } from "./flowService.ts";

export type PrimaryBackendMode = "own-server" | "attach";

export type BackgroundModeReason =
  | "forced-own-server"
  | "unsupported-host"
  | "background-setting"
  | "development-build"
  | "no-service"
  | "decision-remembered"
  | "switched"
  | "kept-background-service"
  | "question-dismissed"
  | "switch-failed";

export type BackgroundModeDecision =
  | {
      readonly _tag: "decided";
      readonly mode: PrimaryBackendMode;
      readonly reason: BackgroundModeReason;
    }
  | { readonly _tag: "ask" };

export interface BackgroundModeInput {
  /** FLOW_DESKTOP_LEGACY_BACKEND=1 (the Dev Flow) or the recovery screen's one-shot relaunch. */
  readonly isOwnServerForced: boolean;
  /** Hosts without a Flow CLI build have no service to attach to. */
  readonly hostSupportsService: boolean;
  readonly runInBackground: boolean;
  /** A development or unpackaged build, which must never stop the installed service. */
  readonly isDevelopment: boolean;
  /** The user already answered the switch question once. */
  readonly isDecisionRemembered: boolean;
}

const decided = (
  mode: PrimaryBackendMode,
  reason: BackgroundModeReason,
): BackgroundModeDecision => ({ _tag: "decided", mode, reason });

/** The rules that need no look at the service, or null when the service decides. */
const decideWithoutService = (input: BackgroundModeInput): BackgroundModeDecision | null => {
  if (input.isOwnServerForced) {
    return decided("own-server", "forced-own-server");
  }
  if (!input.hostSupportsService) {
    return decided("own-server", "unsupported-host");
  }
  if (input.runInBackground) {
    return decided("attach", "background-setting");
  }
  if (input.isDevelopment) {
    return decided("own-server", "development-build");
  }
  return null;
};

/**
 * Which server the primary uses this launch. A running service is asked about
 * even after an earlier answer: it holds the data home, so the app's own server
 * could not start beside it. One that only starts at login is asked about once.
 */
export const decideBackgroundMode = (
  input: BackgroundModeInput & { readonly service: FlowServicePresence },
): BackgroundModeDecision => {
  const early = decideWithoutService(input);
  if (early !== null) {
    return early;
  }
  if (input.service === "none") {
    return decided("own-server", "no-service");
  }
  if (input.service === "autostart" && input.isDecisionRemembered) {
    return decided("own-server", "decision-remembered");
  }
  return { _tag: "ask" };
};

/** Whether this launch may change the mode at all: forced and development
    builds never touch the installed service. */
const canSwitchBackgroundMode = (input: BackgroundModeInput): boolean =>
  !input.isOwnServerForced && input.hostSupportsService && !input.isDevelopment;

export interface BackgroundSwitchPrompt {
  readonly title: string;
  readonly message: string;
  readonly detail: string;
  readonly switchLabel: string;
  readonly keepLabel: string;
}

/** The owner's wording for the one question asked at startup. */
export const describeBackgroundSwitchPrompt = (productName: string): BackgroundSwitchPrompt => ({
  title: productName,
  message: "Stop the background service and turn off its autostart?",
  detail: `${productName} now runs only while the app is open. Running chats will end.`,
  switchLabel: "Switch",
  keepLabel: "Keep background service",
});

/** `dismissed`: the question could not be shown, so nothing is decided. */
export type BackgroundSwitchAnswer = "switch" | "keep" | "dismissed";

/** Every side effect of the startup decision. */
export interface BackgroundModeSeams {
  readonly readInput: Effect.Effect<BackgroundModeInput>;
  readonly readServicePresence: Effect.Effect<FlowServicePresence>;
  readonly ask: Effect.Effect<BackgroundSwitchAnswer>;
  /** Stops the service and turns off its start at login (`disableFlowService`). */
  readonly disableService: Effect.Effect<DesktopFlowServiceActionResult>;
  /** Saves `runInBackground: true`. */
  readonly keepRunningInBackground: Effect.Effect<void>;
  readonly rememberDecision: Effect.Effect<void>;
  readonly reportSwitchFailure: (detail: string) => Effect.Effect<void>;
}

export interface ResolvedBackgroundMode {
  readonly mode: PrimaryBackendMode;
  readonly reason: BackgroundModeReason;
  readonly canSwitch: boolean;
}

/**
 * Decides the launch's mode, asking first when a service holds the data home.
 * "Switch" stops and disables the service, then the app starts its own server;
 * a switch that fails attaches for this launch and asks again at the next one.
 */
export const resolveBackgroundMode = Effect.fn("desktop.backgroundMode.resolve")(function* (
  seams: BackgroundModeSeams,
) {
  const input = yield* seams.readInput;
  const canSwitch = canSwitchBackgroundMode(input);
  const resolved = (
    mode: PrimaryBackendMode,
    reason: BackgroundModeReason,
  ): ResolvedBackgroundMode => ({ mode, reason, canSwitch });

  // Checked before the service is read: a forced or development launch never looks at it.
  const early = decideWithoutService(input);
  if (early?._tag === "decided") {
    return resolved(early.mode, early.reason);
  }
  const decision = decideBackgroundMode({
    ...input,
    service: yield* seams.readServicePresence,
  });
  if (decision._tag === "decided") {
    return resolved(decision.mode, decision.reason);
  }

  const answer = yield* seams.ask;
  if (answer === "dismissed") {
    return resolved("attach", "question-dismissed");
  }
  if (answer === "keep") {
    yield* seams.keepRunningInBackground;
    yield* seams.rememberDecision;
    return resolved("attach", "kept-background-service");
  }
  const disabled = yield* seams.disableService;
  if (!disabled.ok) {
    yield* seams.reportSwitchFailure(disabled.detail ?? "The background service did not stop.");
    return resolved("attach", "switch-failed");
  }
  yield* seams.rememberDecision;
  return resolved("own-server", "switched");
});
