// @effect-diagnostics nodeBuiltinImport:off - the bundled bootstrap is read from disk once per start to learn which repository this app belongs to.
// Flow: asks once per app start, after the desktop attached to the service,
// whether to move the service to this app's version (decision and wording in
// ServiceVersionSync.ts). The question is a native box because the window at
// that moment shows the service's own client, which an older service ships
// without this feature. Once the user agrees, the window is parked off the
// service and renders the app's bundled client, whose recovery screen shows
// the progress, the error and a retry while the service restarts under it.
//
// Never runs in a development build or when the app runs its own backend (the
// Dev Flow): those must not touch the installed service or its release home.

import * as NodeFSP from "node:fs/promises";

import {
  ORCHESTRATION_PROTOCOL_HEADER,
  ORCHESTRATION_PROTOCOL_VERSION_TEXT,
  type DesktopFlowServiceUpdate,
} from "@t3tools/contracts";
import { BRAND } from "@t3tools/shared/branding";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { HttpClient, HttpClientResponse } from "effect/http";

import * as DesktopBackendPool from "./DesktopBackendPool.ts";
import * as DesktopLocalEnvironmentAuth from "./DesktopLocalEnvironmentAuth.ts";
import { DesktopServiceSyncState } from "./DesktopServiceSyncState.ts";
import * as ServiceVersionSync from "./ServiceVersionSync.ts";
import {
  desktopServiceRegistryRoot,
  discoverService,
  resolveFlowReleaseHome,
} from "./serviceDiscovery.ts";
import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as DesktopObservability from "../app/DesktopObservability.ts";
import * as DesktopState from "../app/DesktopState.ts";
import * as ElectronDialog from "../electron/ElectronDialog.ts";
import * as DesktopWindow from "../window/DesktopWindow.ts";

const { logInfo, logWarning } = DesktopObservability.makeComponentLogger("desktop-service-sync");

const RUNNING_CHATS_TIMEOUT = Duration.seconds(10);
const CONFIRM_BUTTON_INDEX = 0;
const LATER_BUTTON_INDEX = 1;

export class DesktopServiceSync extends Context.Service<
  DesktopServiceSync,
  {
    readonly current: Effect.Effect<DesktopFlowServiceUpdate | null>;
    /** Runs a failed update again in the background. */
    readonly retry: Effect.Effect<void>;
    /** Leaves the service as it is for this session and reattaches to it. */
    readonly skip: Effect.Effect<void>;
  }
>()("@t3tools/desktop/backend/DesktopServiceSync") {}

export const layer = Layer.effect(
  DesktopServiceSync,
  Effect.gen(function* () {
    const environment = yield* DesktopEnvironment.DesktopEnvironment;
    const { primaryBackendStartup } = yield* DesktopState.DesktopState;
    const pool = yield* DesktopBackendPool.DesktopBackendPool;
    const auth = yield* DesktopLocalEnvironmentAuth.DesktopLocalEnvironmentAuth;
    const desktopWindow = yield* DesktopWindow.DesktopWindow;
    const electronDialog = yield* ElectronDialog.ElectronDialog;
    const httpClient = yield* HttpClient.HttpClient;
    const state = yield* DesktopServiceSyncState;
    const executablePath = yield* HostProcess.ExecutablePath;
    const layerScope = yield* Scope.Scope;
    const lastInput = yield* Ref.make(Option.none<ServiceVersionSync.ServiceUpdateInput>());

    const readRunningChats = Effect.gen(function* () {
      const httpBaseUrl = yield* pool.primaryHttpBaseUrl;
      if (Option.isNone(httpBaseUrl)) {
        return null;
      }
      const token = yield* auth.getBearerToken;
      const url = new URL("/api/orchestration/shell", httpBaseUrl.value);
      url.searchParams.set("omitOlderSettled", "1");
      url.searchParams.set("omitIdleSubagents", "1");
      const response = yield* httpClient
        .get(url.href, {
          headers: {
            authorization: `Bearer ${token}`,
            [ORCHESTRATION_PROTOCOL_HEADER]: ORCHESTRATION_PROTOCOL_VERSION_TEXT,
          },
        })
        .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
      return ServiceVersionSync.countRunningChats(yield* response.json);
    }).pipe(
      Effect.timeoutOption(RUNNING_CHATS_TIMEOUT),
      Effect.map(Option.getOrNull),
      // The question still has to be asked; it then says the count is unknown.
      Effect.catchCause(() => Effect.succeed(null)),
    );

    const seamsFor = (registryRoot: string): ServiceVersionSync.ServiceUpdateSeams => ({
      run: ServiceVersionSync.runServiceCommand,
      discover: () => Effect.promise(() => discoverService({ registryRoot })),
      realpath: (path) =>
        Effect.promise(() =>
          NodeFSP.realpath(path).then(
            (value) => Option.some(value),
            () => Option.none<string>(),
          ),
        ),
      readRelease: (directory) =>
        Effect.promise(() => ServiceVersionSync.readServiceRelease(directory)),
      sleep: (millis) => Effect.sleep(millis),
      report: (update) => Ref.set(state.update, Option.some(update)),
    });

    const runUpdate = Effect.fn("desktop.serviceSync.update")(function* (
      input: ServiceVersionSync.ServiceUpdateInput,
    ) {
      const outcome = yield* ServiceVersionSync.runServiceUpdate(
        input,
        seamsFor(input.registryRoot),
      );
      for (const step of outcome.steps) {
        yield* logInfo("service update step", { step: step.name, ok: step.ok });
      }
      if (outcome.outcome === "failed") {
        yield* logWarning("service update failed", { failure: outcome.failure?.message });
        return;
      }
      // The new service answers on the same port. Attaching again checks it
      // speaks this app's protocol; the window reloads once it reads `updated`.
      yield* pool.retryPrimaryAttach;
    });

    const startUpdate = Effect.fn("desktop.serviceSync.start")(function* (
      input: ServiceVersionSync.ServiceUpdateInput,
    ) {
      yield* Ref.set(lastInput, Option.some(input));
      yield* Ref.set(
        state.update,
        Option.some({
          outcome: "in-progress",
          targetVersion: input.targetVersion,
          steps: [],
          failure: null,
        }),
      );
      // Parked now, so this reload renders the app's own client and its
      // update screen rather than the service that is about to restart.
      yield* desktopWindow.runMainContentsCommand("reload");
      yield* runUpdate(input);
    });

    const offer = Effect.fn("desktop.serviceSync.offer")(function* () {
      const primary = yield* pool.primary;
      const decisionGate = {
        isDevelopment: environment.isDevelopment || !environment.isPackaged,
        ownBackend: primary.detached !== true,
      };
      // Checked before any file is read: a Dev Flow never looks at the installed service.
      if (decisionGate.isDevelopment || decisionGate.ownBackend) {
        yield* logInfo("service version check skipped", decisionGate);
        return;
      }
      // The installed release home only, the one adoption installs into; never
      // a `flow` found on PATH, which may be a developer's checkout.
      const releaseHome = resolveFlowReleaseHome({ homeDirectory: environment.homeDirectory });
      const registryRoot = desktopServiceRegistryRoot({
        homeDirectory: environment.homeDirectory,
      });
      const discovery = yield* Effect.promise(() => discoverService({ registryRoot }));
      if (discovery.status !== "ready" || discovery.dataHome === undefined) {
        return;
      }
      const dataHome = discovery.dataHome;
      const bootstrapSource = yield* Effect.promise(() =>
        NodeFSP.readFile(environment.flowReleaseScriptPath, "utf8").catch(() => ""),
      );
      const appRepository = ServiceVersionSync.parseReleaseRepository(bootstrapSource);
      const installed = yield* Effect.promise(() =>
        ServiceVersionSync.readInstalledService({
          releaseHome,
          runningCode: discovery.runningCode,
        }),
      );
      const decision = ServiceVersionSync.decideServiceSync({
        ...decisionGate,
        appVersion: environment.appVersion,
        appRepository,
        running: installed.running,
        prepared: installed.prepared,
      });
      yield* logInfo("service version check", {
        decision: decision._tag === "skip" ? decision.reason : "offer",
        appVersion: environment.appVersion,
        serviceVersion: installed.running?.version ?? null,
        serviceRepository: installed.running?.repository ?? null,
      });
      if (decision._tag === "skip") {
        return;
      }

      const runningChats = yield* readRunningChats;
      const prompt = ServiceVersionSync.describeServiceSyncPrompt(
        decision,
        runningChats,
        BRAND.name,
      );
      const owner = yield* desktopWindow.ensureMain;
      const answer = yield* electronDialog.showMessageBox(
        {
          type: "question",
          title: prompt.title,
          message: prompt.message,
          detail: prompt.detail,
          buttons: [prompt.confirmLabel, prompt.laterLabel],
          defaultId: CONFIRM_BUTTON_INDEX,
          cancelId: LATER_BUTTON_INDEX,
          noLink: true,
        },
        owner,
      );
      // "Later" changes nothing; the next app start asks again.
      if (answer.response !== CONFIRM_BUTTON_INDEX) {
        return;
      }
      yield* startUpdate({
        executablePath,
        flowReleaseScriptPath: environment.flowReleaseScriptPath,
        releaseHome,
        registryRoot,
        targetVersion: decision.targetVersion,
        appRepository: decision.appRepository,
        dataHome,
      });
    });

    yield* SubscriptionRef.changes(primaryBackendStartup).pipe(
      Stream.filter((startup) => startup._tag === "Ready"),
      Stream.take(1),
      Stream.runForEach(() => offer()),
      Effect.catchCause((cause) => logWarning("service version check stopped", { cause })),
      Effect.forkScoped,
    );

    const retry = Effect.gen(function* () {
      const current = yield* Ref.get(state.update);
      const input = yield* Ref.get(lastInput);
      const isFailed = Option.exists(current, (update) => update.outcome === "failed");
      if (!isFailed || Option.isNone(input)) {
        return;
      }
      yield* Ref.set(
        state.update,
        Option.some({
          outcome: "in-progress",
          targetVersion: input.value.targetVersion,
          steps: [],
          failure: null,
        }),
      );
      yield* runUpdate(input.value).pipe(
        Effect.catchCause((cause) => logWarning("service update retry stopped", { cause })),
        Effect.forkIn(layerScope),
      );
    });

    const skip = Ref.set(state.update, Option.none()).pipe(Effect.andThen(pool.retryPrimaryAttach));

    return DesktopServiceSync.of({
      current: Ref.get(state.update).pipe(Effect.map(Option.getOrNull)),
      retry,
      skip,
    });
  }),
);
