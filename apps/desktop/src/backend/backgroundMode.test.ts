// @effect-diagnostics nodeBuiltinImport:off - the switch runs the real disable sequence against a temporary service registry and a recording command runner.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { DesktopFlowServiceActionResult } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import {
  decideBackgroundMode,
  resolveBackgroundMode,
  type BackgroundModeDecision,
  type BackgroundModeInput,
  type BackgroundModeSeams,
  type BackgroundSwitchAnswer,
} from "./backgroundMode.ts";
import {
  disableFlowService,
  unitLocation,
  type FlowServicePresence,
  type ServiceProcessRunner,
} from "./flowService.ts";

const appOnlyLaunch: BackgroundModeInput = {
  isOwnServerForced: false,
  hostSupportsService: true,
  runInBackground: false,
  isDevelopment: false,
  isDecisionRemembered: false,
};

const ownServer = (reason: string) => ({ _tag: "decided", mode: "own-server", reason });
const attach = (reason: string) => ({ _tag: "decided", mode: "attach", reason });
const ask = { _tag: "ask" };

describe("decideBackgroundMode", () => {
  it.each<[string, Partial<BackgroundModeInput>, FlowServicePresence, unknown]>([
    ["no service: the app's own server", {}, "none", ownServer("no-service")],
    ["a running service holding the home: ask", {}, "running", ask],
    ["a service starting at login: ask", {}, "autostart", ask],
    [
      "a service starting at login after an answer: own server",
      { isDecisionRemembered: true },
      "autostart",
      ownServer("decision-remembered"),
    ],
    [
      "a running service after an answer: ask again, it holds the home",
      { isDecisionRemembered: true },
      "running",
      ask,
    ],
    [
      "background mode: attach as before",
      { runInBackground: true },
      "running",
      attach("background-setting"),
    ],
    [
      "FLOW_DESKTOP_LEGACY_BACKEND (Dev Flow) wins over background mode",
      { isOwnServerForced: true, runInBackground: true },
      "running",
      ownServer("forced-own-server"),
    ],
    [
      "a development build never touches the service",
      { isDevelopment: true },
      "running",
      ownServer("development-build"),
    ],
    [
      "a development build in background mode attaches as before",
      { isDevelopment: true, runInBackground: true },
      "running",
      attach("background-setting"),
    ],
    [
      "a host without a Flow service build",
      { hostSupportsService: false, runInBackground: true },
      "running",
      ownServer("unsupported-host"),
    ],
  ])("%s", (_name, overrides, service, expected) => {
    const decision: BackgroundModeDecision = decideBackgroundMode({
      ...appOnlyLaunch,
      ...overrides,
      service,
    });
    expect(decision).toEqual(expected);
  });
});

interface SwitchFixture {
  readonly seams: BackgroundModeSeams;
  readonly commands: Array<{ readonly command: string; readonly args: readonly string[] }>;
  readonly events: string[];
}

/** A machine with an installed systemd unit for a stopped service, and every
    other seam recording what it was asked to do. */
const switchFixture = (input: {
  readonly answer: BackgroundSwitchAnswer;
  readonly runnerSucceeds?: boolean;
}) =>
  Effect.acquireRelease(
    Effect.promise(() => NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "flow-app-only-"))),
    (home) => Effect.promise(() => NodeFSP.rm(home, { recursive: true, force: true })),
  ).pipe(
    Effect.tap((home) =>
      Effect.promise(async () => {
        const unitPath = unitLocation({ homeDirectory: home, host: "linux" }).path;
        await NodeFSP.mkdir(NodePath.dirname(unitPath), { recursive: true });
        await NodeFSP.writeFile(unitPath, "[Service]\n");
      }),
    ),
    Effect.map((home): SwitchFixture => {
      const commands: SwitchFixture["commands"] = [];
      const events: string[] = [];
      const run: ServiceProcessRunner = (command, args) => {
        commands.push({ command, args });
        const ok = input.runnerSucceeds ?? true;
        return Promise.resolve({ ok, stdout: "", stderr: ok ? "" : "Access denied" });
      };
      const record = (event: string) => Effect.sync(() => void events.push(event));
      return {
        commands,
        events,
        seams: {
          readInput: Effect.succeed(appOnlyLaunch),
          readServicePresence: Effect.succeed("running"),
          ask: record("asked").pipe(Effect.as(input.answer)),
          disableService: Effect.promise((): Promise<DesktopFlowServiceActionResult> =>
            disableFlowService({
              registryRoot: NodePath.join(home, "instance-home"),
              homeDirectory: home,
              host: "linux",
              uid: 1000,
              run,
            }),
          ).pipe(Effect.tap(() => record("disabled"))),
          keepRunningInBackground: record("saved runInBackground"),
          rememberDecision: record("remembered"),
          reportSwitchFailure: (detail) => record(`reported: ${detail}`),
        },
      };
    }),
  );

describe("resolveBackgroundMode", () => {
  it.effect("Switch stops and disables the service, then runs the app's own server", () =>
    Effect.gen(function* () {
      const fixture = yield* switchFixture({ answer: "switch" });

      const resolved = yield* resolveBackgroundMode(fixture.seams);

      expect(resolved).toEqual({ mode: "own-server", reason: "switched", canSwitch: true });
      expect(fixture.commands).toEqual([
        { command: "systemctl", args: ["--user", "disable", "--now", "flow.service"] },
      ]);
      expect(fixture.events).toEqual(["asked", "disabled", "remembered"]);
    }).pipe(Effect.scoped),
  );

  it.effect("Keep background service turns the setting on and attaches, running nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* switchFixture({ answer: "keep" });

      const resolved = yield* resolveBackgroundMode(fixture.seams);

      expect(resolved).toEqual({
        mode: "attach",
        reason: "kept-background-service",
        canSwitch: true,
      });
      expect(fixture.commands).toEqual([]);
      expect(fixture.events).toEqual(["asked", "saved runInBackground", "remembered"]);
    }).pipe(Effect.scoped),
  );

  it.effect("a refused switch attaches for this launch and asks again next time", () =>
    Effect.gen(function* () {
      const fixture = yield* switchFixture({ answer: "switch", runnerSucceeds: false });

      const resolved = yield* resolveBackgroundMode(fixture.seams);

      expect(resolved.mode).toBe("attach");
      expect(resolved.reason).toBe("switch-failed");
      expect(fixture.events).toEqual(["asked", "disabled", "reported: Access denied"]);
    }).pipe(Effect.scoped),
  );

  it.effect("the Dev Flow never reads or asks about the service", () =>
    Effect.gen(function* () {
      const fixture = yield* switchFixture({ answer: "switch" });

      const resolved = yield* resolveBackgroundMode({
        ...fixture.seams,
        readInput: Effect.succeed({ ...appOnlyLaunch, isOwnServerForced: true }),
        readServicePresence: Effect.die("the service must not be read"),
      });

      expect(resolved).toEqual({
        mode: "own-server",
        reason: "forced-own-server",
        canSwitch: false,
      });
      expect(fixture.commands).toEqual([]);
      expect(fixture.events).toEqual([]);
    }).pipe(Effect.scoped),
  );
});
