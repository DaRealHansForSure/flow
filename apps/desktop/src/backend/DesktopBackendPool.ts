import { BRAND } from "@t3tools/shared/branding";
import type { DesktopFlowServiceActionResult } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as SynchronizedRef from "effect/SynchronizedRef";

import * as FileSystem from "effect/FileSystem";
import { HttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";

import * as DesktopAttachedBackend from "./DesktopAttachedBackend.ts";
import * as DesktopBackendConfiguration from "./DesktopBackendConfiguration.ts";
import * as DesktopBackendManager from "./DesktopBackendManager.ts";
import * as DesktopServerExposure from "./DesktopServerExposure.ts";
import * as DesktopServiceAdoption from "./DesktopServiceAdoption.ts";
import * as DesktopServiceSyncState from "./DesktopServiceSyncState.ts";
import * as ServiceVersionSync from "./ServiceVersionSync.ts";
import * as FlowService from "./flowService.ts";
import * as FlowServiceRecovery from "./flowServiceRecovery.ts";
import { flowServiceSupportsHost } from "./serviceDiscovery.ts";
import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as DesktopObservability from "../app/DesktopObservability.ts";
import * as DesktopState from "../app/DesktopState.ts";
import * as DesktopAppSettings from "../settings/DesktopAppSettings.ts";
import * as DesktopTelemetryPublisher from "../telemetry/DesktopTelemetryPublisher.ts";
import * as DesktopBrowserHost from "../preview/DesktopBrowserHost.ts";
import * as DesktopWindow from "../window/DesktopWindow.ts";
import * as DesktopWslEnvironment from "../wsl/DesktopWslEnvironment.ts";
import * as ElectronDialog from "../electron/ElectronDialog.ts";
import * as ElectronApp from "../electron/ElectronApp.ts";

const { logWarning: logBackendPoolWarning } =
  DesktopObservability.makeComponentLogger("desktop-backend-pool");

export type BackendInstanceId = DesktopBackendManager.BackendInstanceId;
export const BackendInstanceId = DesktopBackendManager.BackendInstanceId;
export const PRIMARY_INSTANCE_ID = DesktopBackendManager.PRIMARY_INSTANCE_ID;
export type DesktopBackendInstance = DesktopBackendManager.DesktopBackendInstance;
export type BackendInstanceSpec = DesktopBackendManager.BackendInstanceSpec;

export class DesktopBackendPoolInstanceAlreadyRegisteredError extends Schema.TaggedError<DesktopBackendPoolInstanceAlreadyRegisteredError>()(
  "DesktopBackendPoolInstanceAlreadyRegisteredError",
  {
    id: Schema.String,
  },
) {
  override get message() {
    return `Backend instance "${this.id}" is already registered in the pool.`;
  }
}

export class DesktopBackendPoolCannotUnregisterPrimaryError extends Schema.TaggedError<DesktopBackendPoolCannotUnregisterPrimaryError>()(
  "DesktopBackendPoolCannotUnregisterPrimaryError",
  {},
) {
  override get message() {
    return "Refusing to unregister the primary backend from the pool.";
  }
}

// An instance that does not report an address (older instance kinds, test
// doubles) reads as "no server", which is exactly how the protocol treats a
// backend it cannot reach.
const primaryHttpBaseUrl = (instance: DesktopBackendInstance): Effect.Effect<Option.Option<URL>> =>
  instance.httpBaseUrl ?? Effect.succeedNone;

export class DesktopBackendPool extends Context.Service<
  DesktopBackendPool,
  {
    readonly get: (id: BackendInstanceId) => Effect.Effect<Option.Option<DesktopBackendInstance>>;
    readonly list: Effect.Effect<readonly DesktopBackendInstance[]>;
    readonly primary: Effect.Effect<DesktopBackendInstance>;
    // Where the primary's server currently answers, or None (attach failed or pending).
    // The `flow://app` protocol reads it on every request, so it stays a cheap read and
    // never mints a credential the way `currentConfig` does.
    readonly primaryHttpBaseUrl: Effect.Effect<Option.Option<URL>>;
    readonly register: (
      spec: BackendInstanceSpec,
    ) => Effect.Effect<DesktopBackendInstance, DesktopBackendPoolInstanceAlreadyRegisteredError>;
    readonly unregister: (
      id: BackendInstanceId,
    ) => Effect.Effect<void, DesktopBackendPoolCannotUnregisterPrimaryError>;
    // Run the primary's start again in the background, and let the user adopt once more
    // if adoption already failed this session. Returns as soon as the attempt is under
    // way, since an attached start can wait out a booting service for two minutes.
    readonly retryPrimaryAttach: Effect.Effect<void>;
  }
>()("@t3tools/desktop/backend/DesktopBackendPool") {}

export type BackendInstanceFactoryRequirements =
  | FileSystem.FileSystem
  | ChildProcessSpawner.ChildProcessSpawner
  | HttpClient.HttpClient
  | DesktopObservability.DesktopBackendOutputLogFactory
  | DesktopTelemetryPublisher.DesktopTelemetryPublisher
  | DesktopBrowserHost.DesktopBrowserHost
  | DesktopWslEnvironment.DesktopWslEnvironment;

interface ActiveRegisteredInstance {
  readonly _tag: "Active";
  readonly instance: DesktopBackendInstance;
  readonly scope: Option.Option<Scope.Closeable>;
}

interface ClosingRegisteredInstance {
  readonly _tag: "Closing";
  readonly done: Deferred.Deferred<void>;
}

type RegisteredInstance = ActiveRegisteredInstance | ClosingRegisteredInstance;

type RegisterAction =
  | { readonly _tag: "Registered"; readonly instance: DesktopBackendInstance }
  | { readonly _tag: "Wait"; readonly done: Deferred.Deferred<void> };

type UnregisterAction =
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Wait"; readonly done: Deferred.Deferred<void> }
  | { readonly _tag: "Close"; readonly entry: ActiveRegisteredInstance };

/** What `handleAttachFailure` needs from the world. Injected so the recovery
    decision can be tested without a window, a filesystem or a real service
    installation. */
export interface AttachFailureRecovery {
  readonly adopt: () => Effect.Effect<DesktopServiceAdoption.AdoptionOutcome>;
  /** Start an installed-but-stopped service (see `flowService.startFlowService`). */
  readonly startService: () => Effect.Effect<DesktopFlowServiceActionResult>;
  readonly logStep: (step: Record<string, unknown>) => Effect.Effect<void>;
  /** Put the failure in front of the user. The window renders the recovery
      screen from the parked failure the bridge hands it; nothing is passed
      here beyond "show it", so the copy lives in one place (the renderer). */
  readonly surface: () => Effect.Effect<void>;
}

/**
 * The attached primary's preflight-failure handler. Only `not-installed`
 * recovers on its own: it adopts the service (DesktopServiceAdoption) at most
 * once per session and returns true for one more attach attempt. Other kinds
 * stay inert: starting or updating the service is the service layer's job.
 */
export const makeAttachFailureHandler = Effect.fn("desktop.backendPool.makeAttachFailureHandler")(
  function* (recovery: AttachFailureRecovery) {
    const adoptionAttempted = yield* Ref.make(false);
    const startAttempted = yield* Ref.make(false);

    const handle = Effect.fn("desktop.backendPool.primaryAttachFailed")(function* (
      failure: DesktopBackendManager.PreflightFailure,
    ) {
      yield* recovery.logStep({
        event: "attach-failed",
        reason: failure.reason,
        kind: failure.attach?.kind ?? "unknown",
      });
      // A stopped service is started, once per session: the app opening is
      // the user asking for Flow, and the service layer owns the start (the
      // service manager or the launcher). If that does not work, the recovery
      // screen says so and offers the same action by hand.
      if (failure.attach?.kind === "stopped" && !(yield* Ref.get(startAttempted))) {
        yield* Ref.set(startAttempted, true);
        const started = yield* recovery.startService();
        yield* recovery.logStep({
          event: "service-start",
          ok: started.ok,
          reason: started.reason,
          detail: started.detail,
        });
        if (started.ok) return true;
        yield* recovery.surface();
        return false;
      }
      if (failure.attach?.kind !== "not-installed" || (yield* Ref.get(adoptionAttempted))) {
        yield* recovery.surface();
        return false;
      }

      yield* Ref.set(adoptionAttempted, true);
      const outcome = yield* recovery.adopt();
      if (outcome._tag !== "already-adopted") {
        for (const step of outcome.journal.steps) {
          yield* recovery.logStep({
            event: "adoption-step",
            step: step.name,
            ok: step.ok,
            ...(step.detail === undefined ? {} : { detail: step.detail }),
          });
        }
      }
      yield* recovery.logStep({ event: "adoption-outcome", outcome: outcome._tag });
      if (outcome._tag === "failed") {
        yield* recovery.surface();
        return false;
      }
      return true;
    });

    // An explicit retry from the recovery screen is the user saying "try the
    // whole thing again", including an adoption that failed the first time.
    // Automatic retries stay capped at one adoption per session.
    const allowAdoption = Effect.all([
      Ref.set(adoptionAttempted, false),
      Ref.set(startAttempted, false),
    ]).pipe(Effect.asVoid);

    return { handle, allowAdoption };
  },
);

export const layer = Layer.effect(
  DesktopBackendPool,
  Effect.gen(function* () {
    const configuration = yield* DesktopBackendConfiguration.DesktopBackendConfiguration;
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    const desktopWindow = yield* DesktopWindow.DesktopWindow;
    const electronDialog = yield* ElectronDialog.ElectronDialog;
    const electronApp = yield* ElectronApp.ElectronApp;
    const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
    const serverExposure = yield* DesktopServerExposure.DesktopServerExposure;
    const { primaryBackendStartup } = yield* DesktopState.DesktopState;
    // Parent instance scopes to the pool so shutdown runs stop finalizers before the OS kills backends.
    const layerScope = yield* Scope.Scope;
    const factoryContext = yield* Effect.context<BackendInstanceFactoryRequirements>();

    // Persist fatal Windows fallbacks; transient transport failures must preserve the user's WSL preference.
    const handlePrimaryPreflightFailure = Effect.fn("desktop.backendPool.primaryPreflightFailed")(
      function* (failure: DesktopBackendManager.PreflightFailure) {
        const { reason, fatal } = failure;
        if (!fatal) {
          yield* logBackendPoolWarning(
            "primary WSL preflight retry window exhausted; using Windows for this launch",
            { reason },
          );
          yield* electronDialog.showErrorBox(
            "WSL backend is still unavailable",
            `${reason}\n\n${BRAND.name} will use the Windows backend for this launch and retry WSL the next time the app starts.`,
          );
          yield* appSettings.applyWslWindowsFallbackInMemory;
          return true;
        }

        yield* logBackendPoolWarning("primary WSL preflight failed; falling back to Windows", {
          reason,
        });
        yield* electronDialog.showErrorBox(
          "WSL backend couldn't start",
          `${reason}\n\nFalling back to the Windows backend so ${BRAND.name} can open. Re-enable the WSL backend from Settings > Sharing & access once the WSL distro is fixed.`,
        );
        // Clear wslOnly too so enabling WSL cannot restore a failed mode.
        // Keep the in-memory fallback if persistence fails.
        yield* appSettings.applyWslWindowsFallback.pipe(
          Effect.catch((error) =>
            logBackendPoolWarning(
              "failed to persist Windows fallback after WSL preflight failure",
              {
                error: error.message,
              },
            ).pipe(Effect.andThen(appSettings.applyWslWindowsFallbackInMemory)),
          ),
        );
        return true;
      },
    );

    // The primary attaches to the `flow` service. The private-child backend is
    // the one-release rollback: FLOW_DESKTOP_LEGACY_BACKEND, or a one-shot marker
    // from the recovery screen, consumed on read so the next launch attaches.
    // Intel Macs and Windows have no Flow CLI build, so no service to attach to.
    const hostPlatform = yield* HostProcess.Platform;
    const hostArchitecture = yield* HostProcess.Architecture;
    const hostUserId = yield* HostProcess.UserId;
    const hostEnvironment = yield* HostProcess.Environment;
    const hostExecutablePath = yield* HostProcess.ExecutablePath;
    const legacyPrimaryRequested =
      !flowServiceSupportsHost(hostPlatform, hostArchitecture) ||
      hostEnvironment.FLOW_DESKTOP_LEGACY_BACKEND === "1" ||
      FlowServiceRecovery.consumeLegacyBackendMarker(environment.stateDir);

    const attachRecovery = yield* makeAttachFailureHandler({
      adopt: () =>
        DesktopServiceAdoption.adoptService({
          homeDirectory: environment.homeDirectory,
          executablePath: hostExecutablePath,
          flowReleaseScriptPath: environment.flowReleaseScriptPath,
        }),
      startService: () =>
        Effect.promise(() =>
          FlowService.startFlowService({
            host: hostPlatform,
            uid: hostUserId ?? 0,
            homeDirectory: environment.homeDirectory,
            // An older registry has no recorded runtime; this binary is a Node 24.
            fallbackNodePath: hostExecutablePath,
            fallbackNodeEnv: { ELECTRON_RUN_AS_NODE: "1" },
          }),
        ),
      logStep: (step) => logBackendPoolWarning("flow service attach recovery", step),
      // The recovery screen is the surface. Opening the window is all this
      // side has to do: the bridge already carries the parked failure, so the
      // renderer decides what to say and which actions to offer. The error box
      // stays only as the last resort for a window that will not open at all.
      surface: () =>
        desktopWindow.ensureMain.pipe(
          Effect.asVoid,
          Effect.catch((error) =>
            logBackendPoolWarning("failed to open the Flow service recovery window", {
              error: error.message,
            }).pipe(
              Effect.andThen(
                electronDialog.showErrorBox(
                  `${BRAND.name} could not connect to its service`,
                  `${BRAND.name} could not open a window to show what went wrong. Check the service with \`flow service status\`.`,
                ),
              ),
            ),
          ),
        ),
    });

    const makeAttachedPrimary = DesktopAttachedBackend.makeAttachedBackendInstance({
      id: DesktopBackendManager.PRIMARY_INSTANCE_ID,
      label: configuration.resolvePrimaryLabel,
      environment: yield* configuration.attachedBackendEnvironment,
      onServiceAttached: ({ httpBaseUrl, networkAccess }) =>
        serverExposure
          .followAttachedService({
            port: Number(httpBaseUrl.port),
            networkAccess,
            setNetworkAccess: (enabled) =>
              Effect.promise(() =>
                FlowService.setFlowServiceNetworkAccess(
                  {
                    host: hostPlatform,
                    uid: hostUserId ?? 0,
                    homeDirectory: environment.homeDirectory,
                  },
                  enabled,
                ),
              ).pipe(
                Effect.catchCause((cause) =>
                  Effect.succeed({
                    ok: false,
                    reason: "failed",
                    detail: Cause.pretty(cause),
                  } satisfies DesktopFlowServiceActionResult),
                ),
              ),
          })
          .pipe(Effect.asVoid),
      onReady: (httpBaseUrl) =>
        desktopWindow.handleBackendReady(httpBaseUrl).pipe(
          Effect.andThen(SubscriptionRef.set(primaryBackendStartup, { _tag: "Ready" })),
          Effect.catch((error) =>
            logBackendPoolWarning("failed to open main window after backend readiness", {
              error: error.message,
            }),
          ),
        ),
      onShutdown: () => desktopWindow.handleBackendNotReady,
      onPreflightFailed: attachRecovery.handle,
    });

    const makeLegacyPrimary = DesktopBackendManager.makeBackendInstance({
      id: DesktopBackendManager.PRIMARY_INSTANCE_ID,
      // Resolve lazily: startup loads persisted settings after pool initialization.
      label: configuration.resolvePrimaryLabel,
      configResolve: configuration.resolvePrimary,
      // Absorb window errors so readiness can reset restartAttempt.
      onReady: (httpBaseUrl) =>
        desktopWindow.handleBackendReady(httpBaseUrl).pipe(
          // Only once the main window exists, so the recovery window never closes into nothing.
          Effect.andThen(SubscriptionRef.set(primaryBackendStartup, { _tag: "Ready" })),
          Effect.catch((error) =>
            logBackendPoolWarning("failed to open main window after backend readiness", {
              error: error.message,
            }),
          ),
        ),
      onStartupFailure: (failure) =>
        SubscriptionRef.set(primaryBackendStartup, { _tag: "Failing", ...failure }),
      onShutdown: () => desktopWindow.handleBackendNotReady,
      onPreflightFailed: handlePrimaryPreflightFailure,
      onStateDirOwned: () =>
        electronDialog
          .showErrorBox(
            `This ${BRAND.name} home is unavailable`,
            `Another ${BRAND.name} server, such as the background Flow service, is using this data directory. Stop that server (check it with \`flow service status\`), then reopen ${BRAND.name}. You can also set a separate T3CODE_HOME and pair with the running server.`,
          )
          .pipe(Effect.andThen(electronApp.quit)),
    });

    // Flow: an attached primary steps aside while the app updates the service.
    const serviceSyncState = yield* DesktopServiceSyncState.DesktopServiceSyncState;
    const primary = legacyPrimaryRequested
      ? yield* makeLegacyPrimary
      : ServiceVersionSync.parkWhileUpdating(
          yield* makeAttachedPrimary,
          DesktopServiceSyncState.isParked(serviceSyncState),
        );

    const instancesRef = yield* SynchronizedRef.make<
      ReadonlyMap<BackendInstanceId, RegisteredInstance>
    >(
      new Map([
        [
          DesktopBackendManager.PRIMARY_INSTANCE_ID,
          { _tag: "Active", instance: primary, scope: Option.none() },
        ],
      ]),
    );

    const register: DesktopBackendPool["Service"]["register"] = (spec) =>
      Effect.suspend(() =>
        SynchronizedRef.modifyEffect(
          instancesRef,
          (
            current,
          ): Effect.Effect<
            readonly [RegisterAction, ReadonlyMap<BackendInstanceId, RegisteredInstance>],
            DesktopBackendPoolInstanceAlreadyRegisteredError
          > => {
            const existing = current.get(spec.id);
            if (existing?._tag === "Active") {
              return Effect.fail(
                new DesktopBackendPoolInstanceAlreadyRegisteredError({ id: spec.id }),
              );
            }
            if (existing?._tag === "Closing") {
              return Effect.succeed([
                { _tag: "Wait", done: existing.done } as const,
                current,
              ] as const);
            }
            return Effect.gen(function* () {
              // Provide the child Scope last so the captured pool Scope cannot shadow it and orphan stop/restart finalizers.
              const instanceScope = yield* Scope.fork(layerScope, "sequential");
              const instance = yield* DesktopBackendManager.makeBackendInstance(spec).pipe(
                Scope.provide(instanceScope),
                Effect.provide(factoryContext),
              );
              const next = new Map(current);
              next.set(spec.id, {
                _tag: "Active",
                instance,
                scope: Option.some(instanceScope),
              });
              return [
                { _tag: "Registered", instance } as const,
                next as ReadonlyMap<BackendInstanceId, RegisteredInstance>,
              ] as const;
            });
          },
        ).pipe(
          Effect.flatMap((result) =>
            result._tag === "Registered"
              ? Effect.succeed(result.instance)
              : Deferred.await(result.done).pipe(Effect.andThen(register(spec))),
          ),
        ),
      );

    const unregister: DesktopBackendPool["Service"]["unregister"] = Effect.fn(
      "DesktopBackendPool.unregister",
    )(function* (id) {
      if (id === DesktopBackendManager.PRIMARY_INSTANCE_ID) {
        return yield* new DesktopBackendPoolCannotUnregisterPrimaryError();
      }
      const done = yield* Deferred.make<void>();
      const action = yield* SynchronizedRef.modifyEffect(
        instancesRef,
        (
          current,
        ): Effect.Effect<
          readonly [UnregisterAction, ReadonlyMap<BackendInstanceId, RegisteredInstance>]
        > => {
          const entry = current.get(id);
          if (entry === undefined) {
            return Effect.succeed([{ _tag: "Absent" } as const, current] as const);
          }
          if (entry._tag === "Closing") {
            return Effect.succeed([{ _tag: "Wait", done: entry.done } as const, current] as const);
          }
          const next = new Map(current);
          next.set(id, { _tag: "Closing", done });
          return Effect.succeed([
            { _tag: "Close", entry } as const,
            next as ReadonlyMap<BackendInstanceId, RegisteredInstance>,
          ] as const);
        },
      );

      if (action._tag === "Absent") return;
      if (action._tag === "Wait") {
        yield* Deferred.await(action.done);
        return;
      }

      const finish = SynchronizedRef.modifyEffect(instancesRef, (current) => {
        const closing = current.get(id);
        if (closing?._tag !== "Closing" || closing.done !== done) {
          return Effect.succeed([undefined, current] as const);
        }
        const next = new Map(current);
        next.delete(id);
        return Effect.succeed([
          undefined,
          next as ReadonlyMap<BackendInstanceId, RegisteredInstance>,
        ] as const);
      }).pipe(Effect.andThen(Deferred.succeed(done, undefined)), Effect.asVoid);
      yield* Option.match(action.entry.scope, {
        onNone: () => Effect.void,
        onSome: (scope) => Scope.close(scope, Exit.void).pipe(Effect.ignore),
      }).pipe(Effect.ensuring(finish));
    });

    return DesktopBackendPool.of({
      get: Effect.fn("DesktopBackendPool.get")(function (id) {
        return SynchronizedRef.get(instancesRef).pipe(
          Effect.map((instances) => {
            const entry = instances.get(id);
            return entry?._tag === "Active" ? Option.some(entry.instance) : Option.none();
          }),
        );
      }),
      list: SynchronizedRef.get(instancesRef).pipe(
        Effect.map((instances) =>
          Array.from(instances.values()).flatMap((entry) =>
            entry._tag === "Active" ? [entry.instance] : [],
          ),
        ),
      ),
      primary: Effect.succeed(primary),
      primaryHttpBaseUrl: primaryHttpBaseUrl(primary),
      register,
      unregister,
      retryPrimaryAttach: attachRecovery.allowAdoption.pipe(
        Effect.andThen(Effect.forkIn(primary.start, layerScope)),
        Effect.asVoid,
      ),
    });
  }),
);

export const layerTest = (
  instances: readonly DesktopBackendInstance[],
): Layer.Layer<DesktopBackendPool> =>
  Layer.effect(
    DesktopBackendPool,
    Effect.gen(function* () {
      if (instances.length === 0) {
        return yield* Effect.die("DesktopBackendPool.layerTest requires at least one instance");
      }
      const byId = new Map<BackendInstanceId, DesktopBackendInstance>(
        instances.map((instance) => [instance.id, instance] as const),
      );
      const primary = instances[0]!;
      return DesktopBackendPool.of({
        get: Effect.fn("DesktopBackendPool.get")(function (id) {
          return Effect.succeed(Option.fromNullishOr(byId.get(id)));
        }),
        list: Effect.succeed(Array.from(byId.values())),
        primary: Effect.succeed(primary),
        primaryHttpBaseUrl: primaryHttpBaseUrl(primary),
        register: Effect.fn("DesktopBackendPool.register")(function () {
          return Effect.die("DesktopBackendPool.layerTest does not support register");
        }),
        unregister: Effect.fn("DesktopBackendPool.unregister")(function () {
          return Effect.die("DesktopBackendPool.layerTest does not support unregister");
        }),
        retryPrimaryAttach: primary.start,
      });
    }),
  );
