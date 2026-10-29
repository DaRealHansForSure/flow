// @effect-diagnostics nodeBuiltinImport:off - Runs a fake provider CLI from a private temp directory.
import { expect, it } from "vite-plus/test";
import * as NodeServices from "@effect/platform-node/NodeServices";
import type { BrainCuratorRun } from "@flow/brain-runtime";
import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { ServerSettingsService } from "../serverSettings.ts";
import { AnalyticsService } from "../telemetry/AnalyticsService.ts";
import { makeBrainCurator } from "./curator.ts";

// Speaks Claude's stream-json: a session per first word of its input, resumed by --resume.
const fakeClaude = (log: string) => `#!${process.execPath}
import * as fs from "node:fs";
const args = process.argv.slice(2);
const input = fs.readFileSync(0, "utf8");
const resume = args.indexOf("--resume");
const session = resume >= 0 ? args[resume + 1] : "fake-" + input.split(" ")[0];
const mcpConfig = JSON.parse(fs.readFileSync(args[args.indexOf("--mcp-config") + 1], "utf8"));
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, input, mcpConfig }) + "\\n");
const emit = (event) => console.log(JSON.stringify({ session_id: session, ...event }));
emit({ type: "system", subtype: "init" });
if (input.includes("fail")) {
  emit({ type: "result", subtype: "success", is_error: true, result: "Claude AI usage limit reached" });
  process.exit(1);
}
emit({ type: "assistant", message: { content: [{ type: "text", text: "noted" }] } });
emit({
  type: "result",
  subtype: "success",
  is_error: false,
  usage: { input_tokens: 10, cache_read_input_tokens: 80, output_tokens: 20 },
});
`;

interface LoggedTurn {
  args: string[];
  input: string;
  mcpConfig: unknown;
}

// A real subprocess fixture, so this runs on the wall clock rather than a TestClock.
it("runs Claude's CLI, resumes its native session, and renews it after a failure", () =>
  Effect.gen(function* () {
    const directory = yield* Effect.acquireRelease(
      Effect.promise(() => NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "flow-curator-runner-"))),
      (path) => Effect.promise(() => NodeFSP.rm(path, { recursive: true, force: true })),
    );
    const log = NodePath.join(directory, "turns.jsonl");
    const binaryPath = NodePath.join(directory, "fake-claude.mjs");
    yield* Effect.promise(() => NodeFSP.writeFile(binaryPath, fakeClaude(log), { mode: 0o755 }));
    const readTurns = () =>
      NodeFS.readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as LoggedTurn);
    const mcpConfigPath = (turn: LoggedTurn) => turn.args[turn.args.indexOf("--mcp-config") + 1]!;

    const analytics: Array<Readonly<Record<string, unknown>>> = [];
    const recordAnalytics = (_event: string, properties?: Readonly<Record<string, unknown>>) =>
      Effect.sync(() => {
        analytics.push(properties ?? {});
      });
    const services = Layer.mergeAll(
      ServerSettingsService.layerTest({
        providerInstances: {
          [ProviderInstanceId.make("claudeAgent")]: {
            driver: ProviderDriverKind.make("claudeAgent"),
            enabled: true,
            config: { binaryPath },
          },
        },
      }),
      Layer.succeed(AnalyticsService, {
        record: recordAnalytics,
        flush: Effect.void,
        recordOwners: () => Effect.void,
      }),
      NodeServices.layer,
    );

    const request: BrainCuratorRun = {
      cli: "claude",
      sessionId: "chat",
      input: "original bounded context",
      instructions: "curate",
      cwd: directory,
      endpoint: "http://127.0.0.1:9/v1/curator/mcp/chat",
      token: "fixture-token",
      renew: true,
    };
    const lastSessionConfig = yield* Effect.scoped(
      Effect.gen(function* () {
        const run = yield* makeBrainCurator;
        const first = yield* Effect.promise(() => run(request));
        expect(first).toEqual({
          nativeThreadId: "fake-original",
          assistantCharacters: 5,
          inputTokens: 90,
          cachedInputTokens: 80,
          outputTokens: 20,
        });
        const resumed = yield* Effect.promise(() =>
          run({ ...request, input: "delta", renew: false }),
        );
        expect(resumed).toMatchObject({ nativeThreadId: "fake-original" });
        const switched = yield* Effect.promise(() =>
          run({ ...request, cli: "codex", renew: false }),
        );
        expect(switched).toEqual({ requiresContext: true });

        const failure = yield* Effect.promise(() =>
          run({ ...request, input: "fail now", renew: false }).then(
            () => undefined,
            (error: Error) => error.message,
          ),
        );
        expect(failure).toBe("Claude AI usage limit reached");
        const discarded = yield* Effect.promise(() =>
          run({ ...request, input: "delta", renew: false }),
        );
        expect(discarded).toEqual({ requiresContext: true });
        const renewed = yield* Effect.promise(() => run({ ...request, input: "renewed context" }));
        expect(renewed).toMatchObject({ nativeThreadId: "fake-renewed" });

        const turns = readTurns();
        expect(turns.map((turn) => turn.input)).toEqual([
          "original bounded context",
          "delta",
          "fail now",
          "renewed context",
        ]);
        expect(turns.map((turn) => turn.args.includes("--resume"))).toEqual([
          false,
          true,
          true,
          false,
        ]);
        expect(turns[1]!.args[turns[1]!.args.indexOf("--resume") + 1]).toBe("fake-original");
        expect(turns[0]!.mcpConfig).toEqual({
          mcpServers: {
            "t3-code": {
              type: "http",
              url: request.endpoint,
              headers: { Authorization: "Bearer fixture-token" },
            },
          },
        });
        // A failed session's private MCP config is removed with it.
        expect(NodeFS.existsSync(mcpConfigPath(turns[2]!))).toBe(false);
        expect(NodeFS.existsSync(mcpConfigPath(turns[3]!))).toBe(true);
        return mcpConfigPath(turns[3]!);
      }).pipe(Effect.provide(services)),
    );
    expect(NodeFS.existsSync(lastSessionConfig)).toBe(false);
    expect(analytics).toEqual([
      {
        success: true,
        renewed: true,
        requiresContext: false,
        assistantCharacters: 5,
        inputTokens: 90,
        cachedInputTokens: 80,
        outputTokens: 20,
      },
      expect.objectContaining({ success: true, renewed: false, requiresContext: false }),
      { success: true, renewed: false, requiresContext: true },
      { success: false, renewed: false, requiresContext: false },
      { success: true, renewed: false, requiresContext: true },
      expect.objectContaining({ success: true, renewed: true, requiresContext: false }),
    ]);
  }).pipe(Effect.scoped, Effect.runPromise));
