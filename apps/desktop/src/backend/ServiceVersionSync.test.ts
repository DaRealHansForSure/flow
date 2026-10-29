// @effect-diagnostics nodeBuiltinImport:off - release receipts are plain files in a temporary release home, read the way the module under test reads them.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import type { DesktopFlowServiceUpdate } from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type * as DesktopBackendManager from "./DesktopBackendManager.ts";
import * as ServiceVersionSync from "./ServiceVersionSync.ts";
import type { ServiceDiscoveryResult } from "./serviceDiscovery.ts";

const FORK = "DaRealHansForSure/flow";
const UPSTREAM = "samyakkkk/flow";

const release = (version: string, repository: string | null) => ({ version, repository });

describe("decideServiceSync", () => {
  const base: ServiceVersionSync.ServiceSyncInput = {
    isDevelopment: false,
    ownBackend: false,
    appVersion: "0.2.0",
    appRepository: FORK,
    running: release("0.1.15", UPSTREAM),
    prepared: release("0.1.15", UPSTREAM),
  };
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly input: Partial<ServiceVersionSync.ServiceSyncInput>;
    readonly expected: string;
  }> = [
    { name: "a development build", input: { isDevelopment: true }, expected: "development-build" },
    { name: "the Dev Flow's own backend", input: { ownBackend: true }, expected: "own-backend" },
    {
      name: "a development build even with its own backend",
      input: { isDevelopment: true, ownBackend: true },
      expected: "development-build",
    },
    {
      name: "a nightly app version",
      input: { appVersion: "0.2.0-nightly.1" },
      expected: "app-not-a-release",
    },
    {
      name: "an app without a known repository",
      input: { appRepository: null },
      expected: "app-not-a-release",
    },
    {
      name: "no release service",
      input: { running: null, prepared: null },
      expected: "no-release-service",
    },
    { name: "an older service from another repository", input: {}, expected: "offer switch 0.2.0" },
    {
      name: "an older service from this repository",
      input: { running: release("0.1.9", FORK), prepared: release("0.1.9", FORK) },
      expected: "offer 0.2.0",
    },
    {
      name: "an older service of unknown source",
      input: { running: release("0.1.9", null), prepared: release("0.1.9", null) },
      expected: "offer 0.2.0",
    },
    {
      name: "the same version from another repository",
      input: { running: release("0.2.0", UPSTREAM), prepared: release("0.2.0", UPSTREAM) },
      expected: "offer switch 0.2.0",
    },
    {
      name: "the same version from this repository",
      input: { running: release("0.2.0", FORK), prepared: release("0.2.0", FORK) },
      expected: "service-current",
    },
    {
      name: "the same version of unknown source",
      input: { running: release("0.2.0", null), prepared: release("0.2.0", null) },
      expected: "service-current",
    },
    {
      name: "a newer service from this repository",
      input: { running: release("0.3.0", FORK), prepared: release("0.3.0", FORK) },
      expected: "service-newer",
    },
    {
      name: "a newer service from another repository",
      input: { running: release("0.3.0", UPSTREAM), prepared: release("0.3.0", UPSTREAM) },
      expected: "service-newer",
    },
    {
      name: "versions compared as numbers",
      input: { appVersion: "0.10.0", running: release("0.9.0", FORK), prepared: null },
      expected: "offer 0.10.0",
    },
    {
      name: "a newer release prepared from another repository",
      input: { prepared: release("0.3.0", UPSTREAM) },
      expected: "would-downgrade",
    },
    {
      name: "a newer release prepared from this repository",
      input: { prepared: release("0.2.1", FORK) },
      expected: "offer switch 0.2.1",
    },
  ];

  it.each(cases)("decides for $name", (testCase) => {
    const decision = ServiceVersionSync.decideServiceSync({ ...base, ...testCase.input });
    let summary: string;
    if (decision._tag === "skip") {
      summary = decision.reason;
    } else {
      const switches = decision.switchesRepository ? "switch " : "";
      summary = `offer ${switches}${decision.targetVersion}`;
    }
    assert.strictEqual(summary, testCase.expected);
  });
});

describe("describeServiceSyncPrompt", () => {
  const offer: ServiceVersionSync.ServiceSyncOffer = {
    _tag: "offer",
    targetVersion: "0.2.0",
    installedVersion: "0.1.15",
    installedRepository: UPSTREAM,
    appRepository: FORK,
    switchesRepository: true,
  };

  it("names running chats and says they will be interrupted", () => {
    const counts: ReadonlyArray<readonly [number | null, string]> = [
      [0, "No chats are running."],
      [1, "1 chat is running and will be interrupted."],
      [2, "2 chats are running and will be interrupted."],
      [
        null,
        "Flow could not check for running chats. Any chat that is running will be interrupted.",
      ],
    ];
    for (const [runningChats, expected] of counts) {
      const prompt = ServiceVersionSync.describeServiceSyncPrompt(offer, runningChats, "Flow");
      assert.strictEqual(prompt.message, "Update the Flow service to 0.2.0?");
      assert.include(prompt.detail, expected);
      assert.deepStrictEqual([prompt.confirmLabel, prompt.laterLabel], ["Update now", "Later"]);
    }
  });

  it("says where the service comes from when the repository changes", () => {
    const switching = ServiceVersionSync.describeServiceSyncPrompt(offer, 0, "Flow");
    assert.include(switching.detail, `It runs 0.1.15 from ${UPSTREAM}.`);
    assert.include(switching.detail, `0.2.0 from ${FORK}`);
    const plain = ServiceVersionSync.describeServiceSyncPrompt(
      { ...offer, installedRepository: FORK, switchesRepository: false },
      0,
      "Flow",
    );
    assert.include(plain.detail, "It runs 0.1.15; this app brings 0.2.0.");
    assert.notInclude(plain.detail, UPSTREAM);
  });
});

describe("countRunningChats", () => {
  it("counts the statuses the web app shows as running, old and new", () => {
    const snapshot = {
      threads: [
        { status: "running" },
        { status: "queued" },
        { status: "preparing" },
        { status: "idle" },
        { status: "waiting" },
        { session: { status: "running" } },
        { session: { status: "starting" } },
        { session: { status: "ready" } },
        { session: null },
        "not a thread",
      ],
    };
    assert.strictEqual(ServiceVersionSync.countRunningChats(snapshot), 5);
    assert.strictEqual(ServiceVersionSync.countRunningChats({ threads: [] }), 0);
    assert.strictEqual(ServiceVersionSync.countRunningChats({ error: "no" }), null);
    assert.strictEqual(ServiceVersionSync.countRunningChats(null), null);
  });
});

describe("reading the installed release", () => {
  const makeReleaseHome = async () => {
    const root = await NodeFSP.realpath(
      await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "service-version-sync-")),
    );
    const writeRelease = async (
      name: string,
      receipt: unknown,
      bootstrapRepository?: string,
    ): Promise<string> => {
      const directory = NodePath.join(root, "releases", name);
      await NodeFSP.mkdir(NodePath.join(directory, "scripts"), { recursive: true });
      await NodeFSP.writeFile(
        NodePath.join(directory, "flow-release.json"),
        JSON.stringify(receipt),
      );
      if (bootstrapRepository !== undefined) {
        await NodeFSP.writeFile(
          NodePath.join(directory, "scripts/flow-release.mjs"),
          `// Flow fork: releases come from here.\nconst repository = "${bootstrapRepository}";\n`,
        );
      }
      return directory;
    };
    return { root, writeRelease, remove: () => NodeFSP.rm(root, { recursive: true, force: true }) };
  };

  it("takes the repository from the receipt, else from the release's bootstrap", async () => {
    const home = await makeReleaseHome();
    try {
      const recorded = await home.writeRelease(
        "flow-v0.2.0-linux-x64",
        { tag: "flow-v0.2.0", sha256: "a", repository: FORK },
        UPSTREAM,
      );
      const upstream = await home.writeRelease(
        "flow-v0.1.15-linux-x64",
        { tag: "flow-v0.1.15", sha256: "b" },
        UPSTREAM,
      );
      const unknown = await home.writeRelease("flow-v0.1.1", { tag: "flow-v0.1.1" });
      const invalid = await home.writeRelease("broken", { tag: "flow-desktop-v0.2.0" });
      assert.deepStrictEqual(
        await ServiceVersionSync.readServiceRelease(recorded),
        release("0.2.0", FORK),
      );
      assert.deepStrictEqual(
        await ServiceVersionSync.readServiceRelease(upstream),
        release("0.1.15", UPSTREAM),
      );
      assert.deepStrictEqual(
        await ServiceVersionSync.readServiceRelease(unknown),
        release("0.1.1", null),
      );
      assert.strictEqual(await ServiceVersionSync.readServiceRelease(invalid), null);
      assert.strictEqual(
        await ServiceVersionSync.readServiceRelease(NodePath.join(home.root, "missing")),
        null,
      );
    } finally {
      await home.remove();
    }
  });

  it("counts the running code only when it is a release of this release home", async () => {
    const home = await makeReleaseHome();
    try {
      const running = await home.writeRelease(
        "flow-v0.1.15-linux-x64",
        { tag: "flow-v0.1.15", sha256: "b" },
        UPSTREAM,
      );
      const prepared = await home.writeRelease("flow-v0.2.0-linux-x64", {
        tag: "flow-v0.2.0",
        sha256: "a",
        repository: FORK,
      });
      await NodeFSP.symlink(prepared, NodePath.join(home.root, "current"));
      const installed = await ServiceVersionSync.readInstalledService({
        releaseHome: home.root,
        runningCode: running,
      });
      assert.deepStrictEqual(installed, {
        running: release("0.1.15", UPSTREAM),
        prepared: release("0.2.0", FORK),
      });
      const checkout = await ServiceVersionSync.readInstalledService({
        releaseHome: home.root,
        runningCode: NodeOS.tmpdir(),
      });
      assert.strictEqual(checkout.running, null);
    } finally {
      await home.remove();
    }
  });
});

describe("runServiceUpdate", () => {
  const INPUT: ServiceVersionSync.ServiceUpdateInput = {
    executablePath: "/opt/Flow/flow",
    flowReleaseScriptPath: "/opt/Flow/resources/flow-bootstrap/flow-release.mjs",
    releaseHome: "/home/alice/.local/share/flow-browser",
    registryRoot: "/home/alice/.local/share/flow-browser/instance-home",
    targetVersion: "0.2.0",
    appRepository: FORK,
    dataHome: "/home/alice/.t3",
  };
  const NEW_CODE = "/home/alice/.local/share/flow-browser/releases/flow-v0.2.0-linux-x64";

  const makeWorld = (input: {
    readonly failArgument?: string;
    readonly dataHomeAfter?: string;
    readonly releaseAfter?: ServiceVersionSync.ServiceRelease;
  }) => {
    const commands: ServiceVersionSync.ServiceCommand[] = [];
    const reports: DesktopFlowServiceUpdate[] = [];
    const seams: ServiceVersionSync.ServiceUpdateSeams = {
      run: (command) => {
        commands.push(command);
        const failed = command.args[1] === input.failArgument;
        return Effect.succeed({ ok: !failed, detail: failed ? "Download failed (404)" : "" });
      },
      discover: () =>
        Effect.succeed({
          status: "ready",
          dataHome: input.dataHomeAfter ?? INPUT.dataHome,
          runningCode: NEW_CODE,
        } satisfies ServiceDiscoveryResult),
      realpath: (path) => Effect.succeedSome(path),
      readRelease: () => Effect.succeed(input.releaseAfter ?? release("0.2.0", FORK)),
      sleep: () => Effect.void,
      report: (update) =>
        Effect.sync(() => {
          reports.push(update);
        }),
    };
    return { commands, reports, seams };
  };

  it.effect("installs the pinned version, restarts onto it and verifies the data home", () =>
    Effect.gen(function* () {
      const world = makeWorld({});
      const outcome = yield* ServiceVersionSync.runServiceUpdate(INPUT, world.seams);
      assert.strictEqual(outcome.outcome, "updated");
      assert.deepStrictEqual(
        outcome.steps.map((step) => step.name),
        ["install-release", "restart-service", "wait-ready", "verify"],
      );
      assert.deepStrictEqual(world.commands, [
        {
          command: INPUT.executablePath,
          args: [INPUT.flowReleaseScriptPath, "install-version", "0.2.0"],
          env: { ELECTRON_RUN_AS_NODE: "1", FLOW_RELEASE_HOME: INPUT.releaseHome },
        },
        {
          command: INPUT.executablePath,
          args: [INPUT.flowReleaseScriptPath, "restart", "--no-open"],
          env: {
            ELECTRON_RUN_AS_NODE: "1",
            FLOW_RELEASE_HOME: INPUT.releaseHome,
            FLOW_INSTANCE_HOME: INPUT.registryRoot,
          },
        },
      ]);
      assert.strictEqual(world.reports.at(-1)?.outcome, "updated");
    }),
  );

  it.effect("a failed download never restarts the service", () =>
    Effect.gen(function* () {
      const world = makeWorld({ failArgument: "install-version" });
      const outcome = yield* ServiceVersionSync.runServiceUpdate(INPUT, world.seams);
      assert.strictEqual(outcome.outcome, "failed");
      assert.deepStrictEqual(outcome.failure, {
        step: "install-release",
        message: "Download failed (404)",
      });
      assert.strictEqual(world.commands.length, 1);
    }),
  );

  it.effect("fails verify when the service came back on another home or release", () =>
    Effect.gen(function* () {
      const movedHome = yield* ServiceVersionSync.runServiceUpdate(
        INPUT,
        makeWorld({ dataHomeAfter: "/home/alice/.flow" }).seams,
      );
      assert.strictEqual(movedHome.failure?.step, "verify");
      const oldRelease = yield* ServiceVersionSync.runServiceUpdate(
        INPUT,
        makeWorld({ releaseAfter: release("0.1.15", UPSTREAM) }).seams,
      );
      assert.strictEqual(oldRelease.failure?.step, "verify");
    }),
  );
});

describe("parkWhileUpdating", () => {
  const config = {
    httpBaseUrl: new URL("http://127.0.0.1:7777/"),
    preflightFailure: Option.none(),
  };
  const instance = {
    id: "primary",
    label: Effect.succeed("Flow"),
    start: Effect.void,
    stop: () => Effect.void,
    currentConfig: Effect.succeedSome(config),
    httpBaseUrl: Effect.succeedSome(config.httpBaseUrl),
    snapshot: Effect.die("unused"),
    waitForReady: () => Effect.succeed(true),
    detached: true,
  } as unknown as DesktopBackendManager.DesktopBackendInstance;

  it.effect("hides the service and reports `updating` only while parked", () =>
    Effect.gen(function* () {
      const parked = ServiceVersionSync.parkWhileUpdating(instance, Effect.succeed(true));
      assert.isTrue(Option.isNone(yield* parked.httpBaseUrl!));
      const parkedConfig = yield* parked.currentConfig;
      const failure = Option.flatMap(parkedConfig, (value) => value.preflightFailure);
      assert.strictEqual(Option.getOrUndefined(failure)?.attach?.kind, "updating");

      const released = ServiceVersionSync.parkWhileUpdating(instance, Effect.succeed(false));
      assert.isTrue(Option.isSome(yield* released.httpBaseUrl!));
      const releasedConfig = yield* released.currentConfig;
      assert.isTrue(
        Option.isNone(Option.flatMap(releasedConfig, (value) => value.preflightFailure)),
      );
    }),
  );
});
