// @effect-diagnostics nodeBuiltinImport:off preferSchemaOverJson:off - the same boundary as DesktopServiceAdoption.ts: plain reads of release receipts this app does not own, and one-shot runs of the bundled Flow bootstrap.
// Flow: every app release brings its matching service. After the desktop has
// attached, it compares the service's release with its own and offers to move
// the service to exactly the app's version from this app's repository.
//
// This deliberately joins the two update trains DesktopServiceAdoption keeps
// apart, within two limits: the user is always asked first, and the service is
// never moved backwards. Data never moves either; the restart keeps the home the
// service already owns, and `verify` proves it.
//
// Everything here is pure or takes its side effects as seams, so the decision,
// the wording and the update sequence are testable without a service.

import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import type { DesktopFlowServiceUpdate } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type * as DesktopBackendManager from "./DesktopBackendManager.ts";
import type { ServiceDiscoveryResult } from "./serviceDiscovery.ts";

const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_TAG = /^flow-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
// The constant `scripts/flow-release.mjs` downloads and updates from.
const REPOSITORY_CONSTANT = /^const repository = "([^"]+)";$/m;
const RELEASE_RECEIPT_FILE = "flow-release.json";
const RELEASE_SCRIPT_PATH = "scripts/flow-release.mjs";

// The supervisor's own readiness deadline, as in DesktopServiceAdoption.ts.
const WAIT_READY_POLL_INTERVAL_MS = 500;
const WAIT_READY_TIMEOUT_MS = 120_000;
// A release install downloads and verifies a bundle of a few hundred megabytes.
const COMMAND_TIMEOUT_MS = 30 * 60_000;
const COMMAND_MAX_BUFFER = 10 * 1024 * 1024;
const FAILURE_DETAIL_MAX_LENGTH = 4000;

/** A Flow release as its receipt describes it. `repository` is null when
    neither the receipt nor the release's own bootstrap names one. */
export interface ServiceRelease {
  readonly version: string;
  readonly repository: string | null;
}

export type ServiceSyncSkipReason =
  | "development-build"
  | "own-backend"
  | "app-not-a-release"
  | "no-release-service"
  | "service-current"
  | "service-newer"
  | "would-downgrade";

export interface ServiceSyncOffer {
  readonly _tag: "offer";
  readonly targetVersion: string;
  readonly installedVersion: string;
  readonly installedRepository: string | null;
  readonly appRepository: string;
  readonly switchesRepository: boolean;
}

export type ServiceSyncDecision =
  | { readonly _tag: "skip"; readonly reason: ServiceSyncSkipReason }
  | ServiceSyncOffer;

export interface ServiceSyncInput {
  /** A development or unpackaged build: its version is not a published release. */
  readonly isDevelopment: boolean;
  /** The app runs its own server (FLOW_DESKTOP_LEGACY_BACKEND, the Dev Flow) and
      must leave the installed service alone. */
  readonly ownBackend: boolean;
  readonly appVersion: string;
  readonly appRepository: string | null;
  /** The release the service runs now; null for no service or a source checkout. */
  readonly running: ServiceRelease | null;
  /** The release `current` points at, which the service runs after its next restart. */
  readonly prepared: ServiceRelease | null;
}

const parseVersion = (version: string): readonly number[] | null => {
  const match = STABLE_VERSION.exec(version);
  if (match === null) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/** Negative, zero or positive as `left` is older, equal or newer. Both must be X.Y.Z. */
const compareVersions = (left: string, right: string): number => {
  const leftParts = parseVersion(left) ?? [0, 0, 0];
  const rightParts = parseVersion(right) ?? [0, 0, 0];
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

const skip = (reason: ServiceSyncSkipReason): ServiceSyncDecision => ({ _tag: "skip", reason });

/**
 * Whether to offer moving the service to the app's version. A service from
 * another repository is offered the switch even at the same version; one of
 * unknown origin counts as this repository's, so only an older one is offered.
 */
export const decideServiceSync = (input: ServiceSyncInput): ServiceSyncDecision => {
  if (input.isDevelopment) {
    return skip("development-build");
  }
  if (input.ownBackend) {
    return skip("own-backend");
  }
  if (parseVersion(input.appVersion) === null || input.appRepository === null) {
    return skip("app-not-a-release");
  }
  const running = input.running;
  if (running === null || parseVersion(running.version) === null) {
    return skip("no-release-service");
  }
  const runningOrder = compareVersions(running.version, input.appVersion);
  if (runningOrder > 0) {
    return skip("service-newer");
  }
  const isFromOtherRepository =
    running.repository !== null && running.repository !== input.appRepository;
  if (runningOrder === 0 && !isFromOtherRepository) {
    return skip("service-current");
  }

  // A release already prepared above the app's version decides the target:
  // one from this repository is where the restart lands anyway, one from
  // another repository could only be replaced by going backwards.
  let targetVersion = input.appVersion;
  const prepared = input.prepared;
  if (prepared !== null && compareVersions(prepared.version, input.appVersion) > 0) {
    if (prepared.repository !== input.appRepository) {
      return skip("would-downgrade");
    }
    targetVersion = prepared.version;
  }
  return {
    _tag: "offer",
    targetVersion,
    installedVersion: running.version,
    installedRepository: running.repository,
    appRepository: input.appRepository,
    switchesRepository: isFromOtherRepository,
  };
};

/** The repository a copy of `flow-release.mjs` downloads from, or null. */
export const parseReleaseRepository = (bootstrapSource: string): string | null =>
  REPOSITORY_CONSTANT.exec(bootstrapSource)?.[1] ?? null;

const readTextOrEmpty = (path: string): Promise<string> =>
  NodeFSP.readFile(path, "utf8").catch(() => "");

/**
 * The release installed in `directory`, from its receipt. Releases installed
 * before receipts recorded a repository name it through their own bootstrap,
 * which is also the feed that release updates from.
 */
export const readServiceRelease = async (directory: string): Promise<ServiceRelease | null> => {
  let receipt: unknown;
  try {
    receipt = JSON.parse(
      await NodeFSP.readFile(NodePath.join(directory, RELEASE_RECEIPT_FILE), "utf8"),
    );
  } catch {
    return null;
  }
  if (typeof receipt !== "object" || receipt === null) {
    return null;
  }
  const { tag, repository } = receipt as { readonly tag?: unknown; readonly repository?: unknown };
  const version = typeof tag === "string" ? RELEASE_TAG.exec(tag)?.[1] : undefined;
  if (version === undefined) {
    return null;
  }
  if (typeof repository === "string" && repository.length > 0) {
    return { version, repository };
  }
  const bootstrap = await readTextOrEmpty(NodePath.join(directory, RELEASE_SCRIPT_PATH));
  return { version, repository: parseReleaseRepository(bootstrap) };
};

/**
 * What the installed service runs and what it would run after a restart. The
 * running code counts only when it is a release inside this release home: a
 * service run from a source checkout is a developer's, never ours to replace.
 */
export const readInstalledService = async (input: {
  readonly releaseHome: string;
  readonly runningCode: string | undefined;
}): Promise<{
  readonly running: ServiceRelease | null;
  readonly prepared: ServiceRelease | null;
}> => {
  const releasesRoot = await NodeFSP.realpath(NodePath.join(input.releaseHome, "releases")).catch(
    () => null,
  );
  const prepared = await readServiceRelease(NodePath.join(input.releaseHome, "current"));
  if (releasesRoot === null || input.runningCode === undefined) {
    return { running: null, prepared };
  }
  const runningCode = await NodeFSP.realpath(input.runningCode).catch(() => null);
  const isReleaseInstall =
    runningCode !== null && runningCode.startsWith(releasesRoot + NodePath.sep);
  return { running: isReleaseInstall ? await readServiceRelease(runningCode) : null, prepared };
};

// The thread statuses the web app counts as running (`isRunning` in
// apps/web/src/state/threads.ts), and for services older than the v2 chat
// engine, the session statuses their sidebar showed as working.
const RUNNING_THREAD_STATUSES = new Set(["preparing", "queued", "starting", "running"]);
const RUNNING_SESSION_STATUSES = new Set(["starting", "running"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Running chats in a `/api/orchestration/shell` snapshot, or null when the
    snapshot has no thread list this app can read. */
export const countRunningChats = (snapshot: unknown): number | null => {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.threads)) {
    return null;
  }
  let runningChats = 0;
  for (const thread of snapshot.threads) {
    if (!isRecord(thread)) {
      continue;
    }
    if (typeof thread.status === "string") {
      if (RUNNING_THREAD_STATUSES.has(thread.status)) {
        runningChats += 1;
      }
      continue;
    }
    const session = thread.session;
    if (isRecord(session) && typeof session.status === "string") {
      if (RUNNING_SESSION_STATUSES.has(session.status)) {
        runningChats += 1;
      }
    }
  }
  return runningChats;
};

export interface ServiceSyncPrompt {
  readonly title: string;
  readonly message: string;
  readonly detail: string;
  readonly confirmLabel: string;
  readonly laterLabel: string;
}

const describeRunningChats = (runningChats: number | null, productName: string): string => {
  if (runningChats === null) {
    return `${productName} could not check for running chats. Any chat that is running will be interrupted.`;
  }
  if (runningChats === 0) {
    return "No chats are running.";
  }
  if (runningChats === 1) {
    return "1 chat is running and will be interrupted.";
  }
  return `${String(runningChats)} chats are running and will be interrupted.`;
};

/** The question asked before anything happens. "Later" asks again at the next start. */
export const describeServiceSyncPrompt = (
  offer: ServiceSyncOffer,
  runningChats: number | null,
  productName: string,
): ServiceSyncPrompt => {
  let source: string;
  if (offer.switchesRepository) {
    source = `It runs ${offer.installedVersion} from ${offer.installedRepository ?? "another repository"}. This app brings ${offer.targetVersion} from ${offer.appRepository}, and the service updates from there from now on.`;
  } else {
    source = `It runs ${offer.installedVersion}; this app brings ${offer.targetVersion}.`;
  }
  return {
    title: `Update the ${productName} service`,
    message: `Update the ${productName} service to ${offer.targetVersion}?`,
    detail: [
      source,
      describeRunningChats(runningChats, productName),
      "Your chats, projects and Brain stay where they are.",
    ].join("\n\n"),
    confirmLabel: "Update now",
    laterLabel: "Later",
  };
};

export interface ServiceCommand {
  readonly command: string;
  readonly args: readonly string[];
  /** Overlay on the inherited environment. */
  readonly env: Readonly<Record<string, string>>;
}

export interface ServiceCommandResult {
  readonly ok: boolean;
  /** The failure's output tail; empty on success, since a restart prints a pairing link. */
  readonly detail: string;
}

/** Every side effect of an update, so the sequence runs against fakes in tests. */
export interface ServiceUpdateSeams {
  readonly run: (command: ServiceCommand) => Effect.Effect<ServiceCommandResult>;
  readonly discover: () => Effect.Effect<ServiceDiscoveryResult>;
  readonly realpath: (path: string) => Effect.Effect<Option.Option<string>>;
  readonly readRelease: (directory: string) => Effect.Effect<ServiceRelease | null>;
  readonly sleep: (millis: number) => Effect.Effect<void>;
  /** Called with the whole state after every step, for the recovery screen. */
  readonly report: (update: DesktopFlowServiceUpdate) => Effect.Effect<void>;
}

export interface ServiceUpdateInput {
  /** Electron's own executable, run as Node through ELECTRON_RUN_AS_NODE. */
  readonly executablePath: string;
  /** The app's bundled bootstrap, whose repository is the app's. */
  readonly flowReleaseScriptPath: string;
  readonly releaseHome: string;
  readonly registryRoot: string;
  readonly targetVersion: string;
  readonly appRepository: string;
  /** The home the service owned before the update; it must own the same one after. */
  readonly dataHome: string;
}

type ServiceUpdateStepName = "install-release" | "restart-service" | "wait-ready" | "verify";

/** Runs one bootstrap command to completion. */
export const runServiceCommand = (command: ServiceCommand): Effect.Effect<ServiceCommandResult> =>
  Effect.promise(
    () =>
      new Promise<ServiceCommandResult>((resolvePromise) => {
        NodeChildProcess.execFile(
          command.command,
          [...command.args],
          {
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: COMMAND_MAX_BUFFER,
            env: { ...process.env, ...command.env },
          },
          (error, stdout, stderr) => {
            if (!error) {
              resolvePromise({ ok: true, detail: "" });
              return;
            }
            const output = `${stdout}${stderr}`.trim();
            const detail = `${error.message}${output ? `: ${output}` : ""}`;
            resolvePromise({ ok: false, detail: detail.slice(-FAILURE_DETAIL_MAX_LENGTH) });
          },
        );
      }),
  );

/**
 * Install the target release with the app's bootstrap, restart the service
 * onto it the way `flow restart` does after an update, wait for it, and check
 * it came back on that release with the same data home.
 */
export const runServiceUpdate = Effect.fn("desktop.serviceSync.runUpdate")(function* (
  input: ServiceUpdateInput,
  seams: ServiceUpdateSeams,
): Effect.fn.Return<DesktopFlowServiceUpdate> {
  const releaseEnv = { ELECTRON_RUN_AS_NODE: "1", FLOW_RELEASE_HOME: input.releaseHome } as const;
  const serviceEnv = { ...releaseEnv, FLOW_INSTANCE_HOME: input.registryRoot } as const;
  const steps: { name: ServiceUpdateStepName; ok: boolean; detail: string | null }[] = [];

  const stateOf = (
    outcome: DesktopFlowServiceUpdate["outcome"],
    failure: DesktopFlowServiceUpdate["failure"],
  ): DesktopFlowServiceUpdate => ({
    outcome,
    targetVersion: input.targetVersion,
    steps: steps.map((step) => ({ ...step })),
    failure,
  });

  const fail = Effect.fn("desktop.serviceSync.failStep")(function* (
    step: ServiceUpdateStepName,
    message: string,
  ) {
    steps.push({ name: step, ok: false, detail: message });
    const failed = stateOf("failed", { step, message });
    yield* seams.report(failed);
    return failed;
  });

  const succeed = Effect.fn("desktop.serviceSync.succeedStep")(function* (
    step: ServiceUpdateStepName,
  ) {
    steps.push({ name: step, ok: true, detail: null });
    yield* seams.report(stateOf("in-progress", null));
  });

  yield* seams.report(stateOf("in-progress", null));

  const installed = yield* seams.run({
    command: input.executablePath,
    args: [input.flowReleaseScriptPath, "install-version", input.targetVersion],
    env: releaseEnv,
  });
  if (!installed.ok) {
    return yield* fail(
      "install-release",
      installed.detail || `Flow ${input.targetVersion} could not be downloaded.`,
    );
  }
  yield* succeed("install-release");

  const restarted = yield* seams.run({
    command: input.executablePath,
    args: [input.flowReleaseScriptPath, "restart", "--no-open"],
    env: serviceEnv,
  });
  if (!restarted.ok) {
    return yield* fail("restart-service", restarted.detail || "The service did not restart.");
  }
  yield* succeed("restart-service");

  let ready: ServiceDiscoveryResult | undefined;
  let last: ServiceDiscoveryResult | undefined;
  const deadlinePolls = Math.ceil(WAIT_READY_TIMEOUT_MS / WAIT_READY_POLL_INTERVAL_MS);
  for (let poll = 0; poll < deadlinePolls && ready === undefined; poll += 1) {
    last = yield* seams.discover();
    if (last.status === "ready") {
      ready = last;
    } else {
      yield* seams.sleep(WAIT_READY_POLL_INTERVAL_MS);
    }
  }
  if (ready === undefined) {
    return yield* fail(
      "wait-ready",
      last?.reason ??
        `The service did not become ready (last status: ${last?.status ?? "unknown"}).`,
    );
  }
  yield* succeed("wait-ready");

  const adoptedHome =
    ready.dataHome === undefined ? Option.none() : yield* seams.realpath(ready.dataHome);
  const expectedHome = yield* seams.realpath(input.dataHome);
  const isSameHome =
    Option.isSome(adoptedHome) &&
    Option.isSome(expectedHome) &&
    adoptedHome.value === expectedHome.value;
  if (!isSameHome) {
    return yield* fail(
      "verify",
      `The service came back with ${ready.dataHome ?? "no data home"} instead of ${input.dataHome}.`,
    );
  }
  const running =
    ready.runningCode === undefined ? null : yield* seams.readRelease(ready.runningCode);
  const isTargetRunning =
    running !== null &&
    running.repository === input.appRepository &&
    compareVersions(running.version, input.targetVersion) >= 0;
  if (!isTargetRunning) {
    const runningLabel =
      running === null
        ? "an unknown release"
        : `${running.version} from ${running.repository ?? "an unknown source"}`;
    return yield* fail(
      "verify",
      `The service restarted on ${runningLabel} instead of ${input.targetVersion} from ${input.appRepository}.`,
    );
  }
  yield* succeed("verify");

  const updated = stateOf("updated", null);
  yield* seams.report(updated);
  return updated;
});

const UPDATING_FAILURE: DesktopBackendManager.PreflightFailure = {
  reason: "The Flow service is being updated.",
  fatal: true,
  attach: { kind: "updating", detail: "" },
};

/**
 * The attached primary as the window sees it while an update runs: no server
 * to proxy to, so the app renders its own bundled client, and a parked
 * `updating` failure, so that client shows the update instead of the workspace.
 */
export const parkWhileUpdating = (
  instance: DesktopBackendManager.DesktopBackendInstance,
  isParked: Effect.Effect<boolean>,
): DesktopBackendManager.DesktopBackendInstance => ({
  ...instance,
  httpBaseUrl: Effect.gen(function* () {
    if (yield* isParked) {
      return Option.none<URL>();
    }
    return yield* instance.httpBaseUrl ?? Effect.succeed(Option.none<URL>());
  }),
  currentConfig: Effect.gen(function* () {
    const config = yield* instance.currentConfig;
    if (Option.isNone(config) || !(yield* isParked)) {
      return config;
    }
    return Option.some({ ...config.value, preflightFailure: Option.some(UPDATING_FAILURE) });
  }),
});
