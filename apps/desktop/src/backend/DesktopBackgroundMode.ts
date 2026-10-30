// @effect-diagnostics nodeBuiltinImport:off - the remembered answer is a marker file in the desktop state directory, the same kind as the recovery screen's legacy-backend marker.
// Flow: wires the launch's backend mode decision (backgroundMode.ts) to the
// real settings, service manager and dialogs, and switches the mode from
// Settings. A switch restarts the app: the own server and the service cannot
// hold the same data home at once, so a live hand-over has nothing to gain.

import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import {
  DEFAULT_CLIENT_SETTINGS,
  type DesktopFlowServiceActionResult,
  type DesktopFlowServiceRecoveryResult,
} from "@t3tools/contracts";
import { BRAND } from "@t3tools/shared/branding";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import * as BackgroundMode from "./backgroundMode.ts";
import * as FlowService from "./flowService.ts";
import * as FlowServiceRecovery from "./flowServiceRecovery.ts";
import { flowServiceSupportsHost } from "./serviceDiscovery.ts";
import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as DesktopObservability from "../app/DesktopObservability.ts";
import * as DesktopState from "../app/DesktopState.ts";
import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronDialog from "../electron/ElectronDialog.ts";
import * as DesktopClientSettings from "../settings/DesktopClientSettings.ts";

const { logInfo, logWarning } = DesktopObservability.makeComponentLogger("desktop-background-mode");

const DECISION_MARKER_FILE = "background-service-decided";
const SWITCH_BUTTON_INDEX = 0;
const KEEP_BUTTON_INDEX = 1;

export class DesktopBackgroundMode extends Context.Service<
  DesktopBackgroundMode,
  {
    /** Decides once per launch, asking first when needed; later calls get the same answer. */
    readonly resolve: Effect.Effect<BackgroundMode.ResolvedBackgroundMode>;
    /** This launch's mode, once `resolve` has run. */
    readonly current: Effect.Effect<Option.Option<BackgroundMode.ResolvedBackgroundMode>>;
    /**
     * Saves `runInBackground` and, when this launch runs the other mode, moves
     * the service over and relaunches the app. `stopOwnServer` frees the data
     * home before the service starts on it.
     */
    readonly switchTo: (input: {
      readonly runInBackground: boolean;
      readonly stopOwnServer: Effect.Effect<void>;
    }) => Effect.Effect<DesktopFlowServiceRecoveryResult>;
  }
>()("@t3tools/desktop/backend/DesktopBackgroundMode") {}

const failedResult = (detail: string): DesktopFlowServiceRecoveryResult => ({ ok: false, detail });
const succeededResult: DesktopFlowServiceRecoveryResult = { ok: true, detail: null };

const isFile = (path: string): Promise<boolean> =>
  NodeFSP.stat(path).then(
    () => true,
    () => false,
  );

export const layer = Layer.effect(
  DesktopBackgroundMode,
  Effect.gen(function* () {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    const clientSettings = yield* DesktopClientSettings.DesktopClientSettings;
    const electronDialog = yield* ElectronDialog.ElectronDialog;
    const electronApp = yield* ElectronApp.ElectronApp;
    const desktopState = yield* DesktopState.DesktopState;
    const platform = yield* HostProcess.Platform;
    const architecture = yield* HostProcess.Architecture;
    const userId = yield* HostProcess.UserId;
    const hostEnvironment = yield* HostProcess.Environment;
    const currentRef = yield* Ref.make(Option.none<BackgroundMode.ResolvedBackgroundMode>());

    const serviceInput: FlowService.FlowServiceInput = {
      host: platform,
      uid: userId ?? 0,
      homeDirectory: environment.homeDirectory,
    };
    const decisionMarkerPath = NodePath.join(environment.stateDir, DECISION_MARKER_FILE);

    // An unreadable settings file reads as the default, app-only.
    const readRunInBackground = clientSettings.get.pipe(
      Effect.map(
        Option.match({
          onNone: () => DEFAULT_CLIENT_SETTINGS.runInBackground,
          onSome: (settings) => settings.runInBackground,
        }),
      ),
      Effect.orElseSucceed(() => DEFAULT_CLIENT_SETTINGS.runInBackground),
    );

    const saveRunInBackground = (runInBackground: boolean) =>
      clientSettings.get.pipe(
        Effect.flatMap((settings) =>
          clientSettings.set({
            ...Option.getOrElse(settings, () => DEFAULT_CLIENT_SETTINGS),
            runInBackground,
          }),
        ),
        Effect.catch((error) =>
          logWarning("failed to save the background mode setting", { message: error.message }),
        ),
      );

    const rememberDecision = Effect.promise(async () => {
      await NodeFSP.mkdir(environment.stateDir, { recursive: true });
      await NodeFSP.writeFile(decisionMarkerPath, "", { mode: 0o600 });
    }).pipe(
      Effect.catchCause((cause) =>
        logWarning("failed to remember the background mode decision", {
          cause: Cause.pretty(cause),
        }),
      ),
    );

    const readInput = Effect.gen(function* () {
      return {
        isOwnServerForced:
          hostEnvironment.FLOW_DESKTOP_LEGACY_BACKEND === "1" ||
          FlowServiceRecovery.consumeLegacyBackendMarker(environment.stateDir),
        hostSupportsService: flowServiceSupportsHost(platform, architecture),
        runInBackground: yield* readRunInBackground,
        isDevelopment: environment.isDevelopment || !environment.isPackaged,
        isDecisionRemembered: yield* Effect.promise(() => isFile(decisionMarkerPath)),
      } satisfies BackgroundMode.BackgroundModeInput;
    });

    const readServicePresence = Effect.promise(() =>
      FlowService.readFlowServicePresence({ ...serviceInput, dataHome: environment.baseDir }),
    ).pipe(
      Effect.catchCause((cause) =>
        logWarning("could not read the background service; starting the app's own server", {
          cause: Cause.pretty(cause),
        }).pipe(Effect.as<FlowService.FlowServicePresence>("none")),
      ),
    );

    const disableService = Effect.promise(() => FlowService.disableFlowService(serviceInput)).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed<DesktopFlowServiceActionResult>({
          ok: false,
          reason: "failed",
          detail: Cause.pretty(cause),
        }),
      ),
    );

    const enableService = Effect.promise(() => FlowService.enableFlowService(serviceInput)).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed<DesktopFlowServiceActionResult>({
          ok: false,
          reason: "failed",
          detail: Cause.pretty(cause),
        }),
      ),
    );

    // A native box: no window exists yet, since the window opens once a backend is ready.
    const ask = Effect.gen(function* () {
      const prompt = BackgroundMode.describeBackgroundSwitchPrompt(BRAND.name);
      const answer = yield* electronDialog.showMessageBox({
        type: "question",
        title: prompt.title,
        message: prompt.message,
        detail: prompt.detail,
        buttons: [prompt.switchLabel, prompt.keepLabel],
        defaultId: SWITCH_BUTTON_INDEX,
        cancelId: KEEP_BUTTON_INDEX,
        noLink: true,
      });
      if (answer.response === SWITCH_BUTTON_INDEX) {
        return "switch" as const;
      }
      return "keep" as const;
    }).pipe(
      Effect.catch((error) =>
        logWarning("could not ask about the background service", { message: error.message }).pipe(
          Effect.as<BackgroundMode.BackgroundSwitchAnswer>("dismissed"),
        ),
      ),
    );

    const reportSwitchFailure = (detail: string) =>
      electronDialog.showErrorBox(
        `${BRAND.name} could not stop the background service`,
        `${detail}\n\n${BRAND.name} uses the background service for now and asks again at the next start.`,
      );

    const resolve = yield* Effect.cached(
      BackgroundMode.resolveBackgroundMode({
        readInput,
        readServicePresence,
        ask,
        disableService,
        keepRunningInBackground: saveRunInBackground(true),
        rememberDecision,
        reportSwitchFailure,
      }).pipe(
        Effect.tap((resolved) =>
          Effect.all([
            Ref.set(currentRef, Option.some(resolved)),
            Ref.set(desktopState.primaryRunsOwnServer, resolved.mode === "own-server"),
            logInfo("backend mode", { mode: resolved.mode, reason: resolved.reason }),
          ]),
        ),
      ),
    );

    // `app.relaunch` cannot carry an environment variable, so the next launch
    // reads the saved setting rather than anything passed along here.
    const relaunch = electronApp
      .relaunch({ args: process.argv.slice(1) })
      .pipe(Effect.andThen(electronApp.exit(0)));

    const switchTo = Effect.fn("desktop.backgroundMode.switchTo")(function* (input: {
      readonly runInBackground: boolean;
      readonly stopOwnServer: Effect.Effect<void>;
    }) {
      const current = yield* Ref.get(currentRef);
      if (Option.isNone(current) || !current.value.canSwitch) {
        return failedResult(`This ${BRAND.name} always runs its own server.`);
      }
      yield* saveRunInBackground(input.runInBackground);
      yield* rememberDecision;
      const targetMode: BackgroundMode.PrimaryBackendMode = input.runInBackground
        ? "attach"
        : "own-server";
      if (current.value.mode === targetMode) {
        return succeededResult;
      }

      if (input.runInBackground) {
        yield* input.stopOwnServer;
        const enabled = yield* enableService;
        // Not installed (`not-managed`) is fine: the next launch adopts a service.
        if (!enabled.ok && enabled.reason !== "not-managed") {
          yield* logWarning("could not start the background service; the next launch retries", {
            detail: enabled.detail,
          });
        }
      } else {
        const disabled = yield* disableService;
        if (!disabled.ok) {
          return failedResult(disabled.detail ?? "The background service did not stop.");
        }
      }
      yield* logInfo("relaunching to switch the backend mode", {
        runInBackground: input.runInBackground,
      });
      yield* relaunch;
      return succeededResult;
    });

    return DesktopBackgroundMode.of({
      resolve,
      current: Ref.get(currentRef),
      switchTo,
    });
  }),
);

/** A fixed mode, for tests of code that only reads it. */
export const layerTest = (resolved: BackgroundMode.ResolvedBackgroundMode) =>
  Layer.succeed(
    DesktopBackgroundMode,
    DesktopBackgroundMode.of({
      resolve: Effect.succeed(resolved),
      current: Effect.succeedSome(resolved),
      switchTo: Effect.fn("DesktopBackgroundMode.switchTo")(function () {
        return Effect.succeed(succeededResult);
      }),
    }),
  );
