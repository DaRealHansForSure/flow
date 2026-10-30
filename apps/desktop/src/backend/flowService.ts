// @effect-diagnostics nodeBuiltinImport:off globalFetch:off - same boundary as serviceDiscovery.ts: plain filesystem and loopback reads of a process this app does not own, with no Effect service to route them through.
// Reverse state for "quitting the app leaves the service running": Settings has
// to be able to say what the service is doing and to stop or restart it.
//
// The canonical implementation of all of this is `scripts/instances/service.mjs`
// (`serviceStatus`, `restartManaged`) and the `flow service` verbs. The desktop
// cannot call it: a packaged app ships no `scripts/` directory, and running a
// launcher would be the app taking over a lifecycle the service manager owns.
// So this module re-reads the same three facts — is a unit installed, has the
// service manager loaded it, what is the instance doing — from the unit file,
// one service-manager query, and the instance registry.
//
// It never installs, uninstalls, writes or repairs anything. Stopping is a request
// to the supervisor's control API; restarting, and turning the start at login off
// or on (Flow's app-only mode), is delegated to the service manager, and is simply
// refused when no service manager owns the unit.

import * as NodeChildProcess from "node:child_process";
import * as NodeTimersPromises from "node:timers/promises";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { DesktopFlowServiceActionResult, DesktopFlowServiceStatus } from "@t3tools/contracts";

import {
  desktopServiceRegistryRoot,
  discoverService,
  readServiceControl,
} from "./serviceDiscovery.ts";

// Kept in sync with `scripts/instances/service.mjs`; the label is part of the
// on-disk contract, so both sides must name it identically.
const LAUNCHD_LABEL = "com.flow.service";
const SYSTEMD_UNIT = "flow.service";

const CONTROL_TIMEOUT_MS = 5_000;
const RUNNER_TIMEOUT_MS = 10_000;
// `systemctl disable --now` returns only once the service has stopped, and systemd
// allows a unit 90 s to stop by default.
const SERVICE_MANAGER_STOP_TIMEOUT_MS = 120_000;

export interface ServiceProcessResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Every service-manager call goes through this, so tests assert the exact
    argv instead of executing `launchctl` or `systemctl`. */
export type ServiceProcessRunner = (
  command: string,
  args: readonly string[],
  options?: { readonly timeoutMs?: number },
) => Promise<ServiceProcessResult>;

const defaultRunner: ServiceProcessRunner = (command, args, options) =>
  new Promise((resolvePromise) => {
    NodeChildProcess.execFile(
      command,
      [...args],
      { timeout: options?.timeoutMs ?? RUNNER_TIMEOUT_MS },
      (error, stdout, stderr) =>
        resolvePromise({
          ok: !error,
          stdout: stdout || "",
          stderr: stderr || String(error?.message ?? ""),
        }),
    );
  });

/** `host` and `uid` are passed in rather than read from `process`: this module
    is plain async code, and the Effect layer above it already resolves both
    from `HostProcessPlatform`/`HostProcessUserId`, which tests override. */
export interface FlowServiceInput {
  readonly host: NodeJS.Platform;
  readonly uid: number;
  readonly registryRoot?: string;
  readonly name?: string;
  readonly homeDirectory?: string;
  readonly run?: ServiceProcessRunner;
  readonly fetch?: typeof globalThis.fetch;
}

interface ResolvedInput {
  readonly registryRoot: string;
  readonly name: string;
  readonly label: string;
  readonly unitPath: string;
  readonly host: NodeJS.Platform;
  readonly uid: number;
  readonly run: ServiceProcessRunner;
  readonly fetchImpl: typeof globalThis.fetch;
}

/** Mirrors `unitLocation()` in `scripts/instances/service.mjs`. */
export const unitLocation = ({
  homeDirectory = NodeOS.homedir(),
  host,
}: {
  readonly homeDirectory?: string;
  readonly host: NodeJS.Platform;
}): {
  readonly label: string;
  readonly path: string;
} =>
  host === "darwin"
    ? {
        label: LAUNCHD_LABEL,
        path: NodePath.join(homeDirectory, "Library/LaunchAgents", `${LAUNCHD_LABEL}.plist`),
      }
    : {
        label: SYSTEMD_UNIT,
        path: NodePath.join(homeDirectory, ".config/systemd/user", SYSTEMD_UNIT),
      };

const resolveInput = (input: FlowServiceInput): ResolvedInput => {
  const host = input.host;
  const location = unitLocation(
    input.homeDirectory === undefined ? { host } : { homeDirectory: input.homeDirectory, host },
  );
  return {
    registryRoot: input.registryRoot ?? desktopServiceRegistryRoot(),
    name: input.name ?? "primary",
    label: location.label,
    unitPath: location.path,
    host,
    uid: input.uid,
    run: input.run ?? defaultRunner,
    fetchImpl: input.fetch ?? globalThis.fetch,
  };
};

const launchdDomain = (resolved: ResolvedInput) => `gui/${String(resolved.uid)}`;
const launchdTarget = (resolved: ResolvedInput) => `${launchdDomain(resolved)}/${resolved.label}`;

// Unreadable is reported as absent rather than thrown: the panel's job is to
// describe the service, and a status read must never fail the renderer.
const readUnit = async (path: string): Promise<string | null> => {
  try {
    return await NodeFSP.readFile(path, "utf8");
  } catch {
    return null;
  }
};

/** launchd plist `ProgramArguments`, or a systemd `ExecStart=` line. Only the
    launch argv is parsed; nothing else in the unit is interpreted here. */
const parseUnitArguments = (unit: string, host: NodeJS.Platform): readonly string[] => {
  if (host === "darwin") {
    const block = /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(unit);
    if (!block) return [];
    return [...block[1]!.matchAll(/<string>([\s\S]*?)<\/string>/g)].map((match) =>
      match[1]!.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"),
    );
  }
  const line = /^ExecStart=(.*)$/m.exec(unit);
  if (!line) return [];
  // `quoteSystemdValue` only ever double-quotes, with backslash escapes inside.
  const tokens = [...line[1]!.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((match) =>
    match[1] === undefined ? match[2]! : match[1].replaceAll('\\"', '"').replaceAll("\\\\", "\\"),
  );
  return tokens.map((token) => token.replaceAll("%%", "%"));
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await NodeFSP.stat(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Whether the installed unit still launches *this* installation's supervisor.
 * `scripts/instances/service.mjs` re-renders the unit instead, which needs a
 * release layout the desktop lacks, so this checks what the unit carries: this
 * registry's instance directory and an entry point that still exists.
 */
const isUnitCurrent = async (unit: string, resolved: ResolvedInput): Promise<boolean> => {
  const argv = parseUnitArguments(unit, resolved.host);
  const superviseIndex = argv.indexOf("--supervise");
  if (superviseIndex < 0 || argv.length <= superviseIndex + 1) return false;
  const directory = NodePath.join(
    NodePath.resolve(resolved.registryRoot),
    "instances",
    resolved.name,
  );
  if (NodePath.resolve(argv[superviseIndex + 1]!) !== directory) return false;
  const entry = argv[1];
  return entry !== undefined && (await exists(entry));
};

const isUnitLoaded = async (resolved: ResolvedInput): Promise<boolean> => {
  if (resolved.host === "darwin") {
    return (await resolved.run("launchctl", ["print", launchdTarget(resolved)])).ok;
  }
  return (await resolved.run("systemctl", ["--user", "is-active", SYSTEMD_UNIT])).ok;
};

export const readFlowServiceStatus = async (
  input: FlowServiceInput,
): Promise<DesktopFlowServiceStatus> => {
  const resolved = resolveInput(input);
  const [unit, discovery] = await Promise.all([
    readUnit(resolved.unitPath),
    discoverService({
      registryRoot: resolved.registryRoot,
      name: resolved.name,
      fetch: resolved.fetchImpl,
    }),
  ]);
  // Asked even when no unit file is present: a unit removed without a
  // `bootout` leaves the service manager still running the job, and a panel
  // that hid that would be lying about what owns the server.
  const loaded = await isUnitLoaded(resolved);
  return {
    installed: unit !== null,
    loaded,
    current: unit === null ? false : await isUnitCurrent(unit, resolved),
    label: resolved.label,
    unitPath: resolved.unitPath,
    instance: {
      // Discovery's status vocabulary is the phase vocabulary the panel renders.
      phase: discovery.status,
      environmentId: discovery.environmentId ?? null,
      dataHome: discovery.dataHome ?? null,
      serverOrigin: discovery.serverOrigin ?? null,
      error: discovery.reason ?? null,
    },
  };
};

const failed = (reason: "not-managed" | "not-running" | "failed", detail: string | null) =>
  ({ ok: false, reason, detail }) satisfies DesktopFlowServiceActionResult;

export const stopFlowService = async (
  input: FlowServiceInput,
): Promise<DesktopFlowServiceActionResult> => {
  const resolved = resolveInput(input);
  const control = await readServiceControl({
    registryRoot: resolved.registryRoot,
    name: resolved.name,
  });
  // No published control endpoint means no supervisor is running. Stopping an
  // already-stopped service is not an error the user needs to see as a failure,
  // but the caller still learns nothing happened.
  if (control === null) return failed("not-running", null);
  try {
    const response = await resolved.fetchImpl(new URL("/stop", control.url), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
      headers: { authorization: `Bearer ${control.token}` },
    });
    if (!response.ok) return failed("failed", "The service refused the stop request.");
    return { ok: true, reason: null, detail: null };
  } catch (cause) {
    return failed("failed", cause instanceof Error ? cause.message : String(cause));
  }
};

/**
 * Turn the service's network access on or off. The supervisor records it (the
 * desktop never writes the registry) and the service manager restarts the
 * service to bind the new address; unmanaged, it applies from the next start,
 * which the `not-managed` result tells the caller.
 */
export const setFlowServiceNetworkAccess = async (
  input: FlowServiceInput,
  enabled: boolean,
): Promise<DesktopFlowServiceActionResult> => {
  const resolved = resolveInput(input);
  const control = await readServiceControl({
    registryRoot: resolved.registryRoot,
    name: resolved.name,
  });
  if (control === null) {
    return failed("not-running", null);
  }
  try {
    const response = await resolved.fetchImpl(new URL("/network-access", control.url), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${control.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });
    if (response.status === 404) {
      return failed(
        "failed",
        "This Flow service is too old to change network access. Update it first.",
      );
    }
    if (!response.ok) {
      return failed("failed", "The service refused the network access request.");
    }
  } catch (cause) {
    return failed("failed", cause instanceof Error ? cause.message : String(cause));
  }
  return restartFlowService(input);
};

/** Spawns a detached process and resolves once it has started. Injected so
    tests assert the argv rather than launching a service. */
export type ServiceProcessLauncher = (
  command: string,
  args: readonly string[],
  env: Readonly<Record<string, string>>,
) => Promise<ServiceProcessResult>;

const defaultLauncher: ServiceProcessLauncher = (command, args, env) =>
  new Promise((resolvePromise) => {
    const child = NodeChildProcess.spawn(command, [...args], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ...env },
    });
    child.once("error", (error) =>
      resolvePromise({ ok: false, stdout: "", stderr: error.message }),
    );
    child.once("spawn", () => {
      child.unref();
      resolvePromise({ ok: true, stdout: "", stderr: "" });
    });
  });

const START_POLL_INTERVAL_MS = 250;
// 20 s: a supervisor publishes its control file well before the server is ready.
const START_SETTLE_POLLS = 80;

export interface StartFlowServiceInput extends FlowServiceInput {
  readonly launch?: ServiceProcessLauncher;
  /** Used to run the launcher when the registry predates the recorded `node`
      (an Electron binary with ELECTRON_RUN_AS_NODE, in production). */
  readonly fallbackNodePath?: string;
  readonly fallbackNodeEnv?: Readonly<Record<string, string>>;
}

/**
 * Start a stopped service through its service manager, or else through its own
 * `flow` launcher, whose locks stop two clients from starting two servers. The
 * desktop never spawns a supervisor itself. Resolves once discovery no longer
 * reports `stopped`.
 */
export const startFlowService = async (
  input: StartFlowServiceInput,
): Promise<DesktopFlowServiceActionResult> => {
  const resolved = resolveInput(input);
  const discovery = await discoverService({
    registryRoot: resolved.registryRoot,
    name: resolved.name,
    fetch: resolved.fetchImpl,
  });
  if (discovery.status === "ready" || discovery.status === "starting")
    return { ok: true, reason: null, detail: null };
  if (discovery.status !== "stopped" && discovery.status !== "failed")
    return failed("failed", discovery.reason ?? `The service is ${discovery.status}.`);
  if (await isUnitLoaded(resolved)) {
    const result =
      resolved.host === "darwin"
        ? await resolved.run("launchctl", ["kickstart", launchdTarget(resolved)])
        : await resolved.run("systemctl", ["--user", "start", SYSTEMD_UNIT]);
    if (!result.ok) return failed("failed", result.stderr.trim() || null);
  } else {
    if (!discovery.runningCode) return failed("failed", "The service has no recorded checkout.");
    const launcher = NodePath.join(discovery.runningCode, "scripts/flow.mjs");
    if (!(await exists(launcher))) return failed("failed", `Missing launcher at ${launcher}.`);
    const node = discovery.nodePath ?? input.fallbackNodePath;
    if (!node) return failed("failed", "No runtime is recorded for the service.");
    const result = await (input.launch ?? defaultLauncher)(node, [launcher, "--no-open"], {
      FLOW_INSTANCE_HOME: resolved.registryRoot,
      ...(discovery.nodePath ? {} : (input.fallbackNodeEnv ?? {})),
    });
    if (!result.ok) return failed("failed", result.stderr.trim() || null);
  }
  for (let poll = 0; poll < START_SETTLE_POLLS; poll += 1) {
    const current = await discoverService({
      registryRoot: resolved.registryRoot,
      name: resolved.name,
      fetch: resolved.fetchImpl,
    });
    if (current.status !== "stopped") return { ok: true, reason: null, detail: null };
    await NodeTimersPromises.setTimeout(START_POLL_INTERVAL_MS);
  }
  return failed("failed", "The service did not start in time.");
};

export const restartFlowService = async (
  input: FlowServiceInput,
): Promise<DesktopFlowServiceActionResult> => {
  const resolved = resolveInput(input);
  // Only the service manager restarts a running service: the desktop never
  // spawns a supervisor itself (see `startFlowService` for the stopped case).
  if (!(await isUnitLoaded(resolved))) return failed("not-managed", null);
  const result =
    resolved.host === "darwin"
      ? await resolved.run("launchctl", ["kickstart", "-k", launchdTarget(resolved)])
      : await resolved.run("systemctl", ["--user", "restart", SYSTEMD_UNIT]);
  if (!result.ok) return failed("failed", result.stderr.trim() || null);
  return { ok: true, reason: null, detail: null };
};

// A supervisor in any of these phases holds the data home, so the app's own
// server could not open it.
const LIVE_SERVICE_STATUSES: ReadonlySet<string> = new Set(["starting", "ready", "stopping"]);
const STOP_POLL_INTERVAL_MS = 250;
// 60 s: a supervisor drains its running chats before it exits.
const STOP_SETTLE_POLLS = 240;

const discover = (resolved: ResolvedInput) =>
  discoverService({
    registryRoot: resolved.registryRoot,
    name: resolved.name,
    fetch: resolved.fetchImpl,
  });

const realpathOrNull = async (path: string): Promise<string | null> => {
  try {
    return await NodeFSP.realpath(path);
  } catch {
    return null;
  }
};

/** launchd lists an override as `"label" => disabled` (newer macOS) or `=> true`. */
const isLaunchdLabelDisabled = (overrides: string, label: string): boolean =>
  overrides.includes(`"${label}" => disabled`) || overrides.includes(`"${label}" => true`);

/** Whether the installed unit starts the service at login. No unit means no. */
const isFlowServiceAutostartEnabled = async (input: FlowServiceInput): Promise<boolean> => {
  const resolved = resolveInput(input);
  if (!(await exists(resolved.unitPath))) {
    return false;
  }
  if (resolved.host === "darwin") {
    const overrides = await resolved.run("launchctl", ["print-disabled", launchdDomain(resolved)]);
    // Without the override list, launchd's default applies: an installed agent loads at login.
    if (!overrides.ok) {
      return true;
    }
    return !isLaunchdLabelDisabled(overrides.stdout, resolved.label);
  }
  return (await resolved.run("systemctl", ["--user", "is-enabled", SYSTEMD_UNIT])).ok;
};

/** How an installed service stands in the way of an app that runs its own
    server on `dataHome`: it holds the home now, or it will at the next login. */
export type FlowServicePresence = "none" | "autostart" | "running";

export const readFlowServicePresence = async (
  input: FlowServiceInput & { readonly dataHome: string },
): Promise<FlowServicePresence> => {
  const resolved = resolveInput(input);
  const discovery = await discover(resolved);
  if (discovery.dataHome === undefined) {
    return "none";
  }
  const [serviceHome, appHome] = await Promise.all([
    realpathOrNull(discovery.dataHome),
    realpathOrNull(input.dataHome),
  ]);
  if (serviceHome === null || serviceHome !== appHome) {
    return "none";
  }
  if (LIVE_SERVICE_STATUSES.has(discovery.status)) {
    return "running";
  }
  if (await isFlowServiceAutostartEnabled(input)) {
    return "autostart";
  }
  return "none";
};

const deactivateUnit = async (resolved: ResolvedInput): Promise<ServiceProcessResult> => {
  if (resolved.host === "darwin") {
    const disabled = await resolved.run("launchctl", ["disable", launchdTarget(resolved)]);
    if (!disabled.ok) {
      return disabled;
    }
    // Fails when the agent is not loaded, which leaves nothing to stop.
    await resolved.run("launchctl", ["bootout", launchdTarget(resolved)], {
      timeoutMs: SERVICE_MANAGER_STOP_TIMEOUT_MS,
    });
    return disabled;
  }
  return resolved.run("systemctl", ["--user", "disable", "--now", SYSTEMD_UNIT], {
    timeoutMs: SERVICE_MANAGER_STOP_TIMEOUT_MS,
  });
};

const waitUntilStopped = async (
  resolved: ResolvedInput,
): Promise<DesktopFlowServiceActionResult> => {
  for (let poll = 0; poll < STOP_SETTLE_POLLS; poll += 1) {
    const current = await discover(resolved);
    if (!LIVE_SERVICE_STATUSES.has(current.status)) {
      return { ok: true, reason: null, detail: null };
    }
    await NodeTimersPromises.setTimeout(STOP_POLL_INTERVAL_MS);
  }
  return failed("failed", "The service did not stop in time.");
};

/**
 * Stop the service and turn off its start at login, keeping unit, release and data.
 * A supervisor the `flow` launcher started is stopped through its control API.
 * Resolves once no supervisor holds the data home.
 */
export const disableFlowService = async (
  input: FlowServiceInput,
): Promise<DesktopFlowServiceActionResult> => {
  const resolved = resolveInput(input);
  if (await exists(resolved.unitPath)) {
    const deactivated = await deactivateUnit(resolved);
    if (!deactivated.ok) {
      return failed("failed", deactivated.stderr.trim() || null);
    }
  }
  const discovery = await discover(resolved);
  if (LIVE_SERVICE_STATUSES.has(discovery.status)) {
    const stopped = await stopFlowService(input);
    if (!stopped.ok && stopped.reason !== "not-running") {
      return stopped;
    }
  }
  return waitUntilStopped(resolved);
};

/**
 * Turn the service's start at login back on and start it. `not-managed` means
 * no unit is installed: the next attach then sets one up through first-launch
 * adoption. Returns without waiting for readiness; attaching waits for that.
 */
export const enableFlowService = async (
  input: FlowServiceInput,
): Promise<DesktopFlowServiceActionResult> => {
  const resolved = resolveInput(input);
  if (!(await exists(resolved.unitPath))) {
    return failed("not-managed", null);
  }
  if (resolved.host === "darwin") {
    const enabled = await resolved.run("launchctl", ["enable", launchdTarget(resolved)]);
    if (!enabled.ok) {
      return failed("failed", enabled.stderr.trim() || null);
    }
    const loaded = await resolved.run("launchctl", [
      "bootstrap",
      launchdDomain(resolved),
      resolved.unitPath,
    ]);
    // bootstrap refuses an agent that is already loaded, which is the goal anyway.
    if (!loaded.ok && !(await isUnitLoaded(resolved))) {
      return failed("failed", loaded.stderr.trim() || null);
    }
    return { ok: true, reason: null, detail: null };
  }
  const result = await resolved.run("systemctl", ["--user", "enable", "--now", SYSTEMD_UNIT], {
    timeoutMs: SERVICE_MANAGER_STOP_TIMEOUT_MS,
  });
  if (!result.ok) {
    return failed("failed", result.stderr.trim() || null);
  }
  return { ok: true, reason: null, detail: null };
};
