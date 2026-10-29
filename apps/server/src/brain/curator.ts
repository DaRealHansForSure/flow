// @effect-diagnostics nodeBuiltinImport:off - Private curator configuration files at the native CLI boundary.
import type { BrainCuratorRun, BrainCuratorResult, BrainCuratorRunner } from "@flow/brain-runtime";
import {
  ClaudeSettings,
  CodexSettings,
  DEFAULT_MODEL,
  DEFAULT_TEXT_GENERATION_MODEL_BY_PROVIDER,
  ProviderDriverKind,
  ProviderInstanceId,
  resolveProviderInstanceEnabled,
  type ProviderInstanceConfig,
  type ServerSettings,
} from "@t3tools/contracts";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";
import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";
import { OpenCodeSettings } from "@t3tools/provider-opencode/settings";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  hasClaudeManagedMcpConfig,
  makeClaudeEnvironment,
} from "../provider/Drivers/ClaudeHome.ts";
import {
  materializeCodexShadowHome,
  resolveCodexHomeLayout,
} from "../provider/Drivers/CodexHomeLayout.ts";
import { deriveProviderInstanceConfigMap } from "../provider/ProviderInstanceRegistryHydration.ts";
import { codexExecLaunchArgs, resolveCodexLaunchArgs } from "../provider/codexLaunchArgs.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { AnalyticsService } from "../telemetry/AnalyticsService.ts";
import {
  claudeCuratorMcpConfig,
  codexMcpServerNames,
  curatorCommand,
  CuratorTurnParser,
  isIsolatableMcpServerName,
  type CuratorLaunch,
} from "./curator-cli.ts";
import { prepareOpenCodeCurator } from "./curator-opencode.ts";
import { runCuratorProcess } from "./curator-process.ts";
import { CuratorSessions } from "./curator-sessions.ts";

const DEFAULT_TURN_TIMEOUT_MS = 240_000;

const decodeCodex = Schema.decodeUnknownEffect(CodexSettings);
const decodeClaude = Schema.decodeUnknownEffect(ClaudeSettings);
const decodeOpenCode = Schema.decodeUnknownEffect(OpenCodeSettings);

class CuratorError extends Schema.TaggedError<CuratorError>()("CuratorError", {
  message: Schema.String,
}) {}

const toCuratorError = (error: unknown) =>
  new CuratorError({ message: error instanceof Error ? error.message : String(error) });

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function codexSubscriptionIssue(
  accountResponse: unknown,
  nativeConfig: unknown,
): string | undefined {
  const account = record(accountResponse);
  if (record(account.account).type !== "chatgpt") {
    return "Sign the selected Codex provider in with ChatGPT to use subscription-backed extraction.";
  }
  const provider = record(nativeConfig).model_provider;
  const usesCustomBackend =
    account.requiresOpenaiAuth === false || (provider != null && provider !== "openai");
  if (usesCustomBackend) {
    return "The selected Codex instance uses a custom model backend. Choose its OpenAI ChatGPT provider for subscription-backed extraction.";
  }
  return undefined;
}

/** A warm native CLI session: its launch is fixed, its native id appears after the first turn. */
interface CuratorSession {
  readonly launch: CuratorLaunch;
  nativeSessionId: string | undefined;
  readonly close: () => Promise<void>;
}

export function curatorSessionKey(
  request: Pick<BrainCuratorRun, "sessionId" | "endpoint" | "token" | "cli">,
): string {
  // Rebinding a project can leave the same chat active in two brains. A worker
  // restart must also replace the native session's now-stale MCP connection.
  return NodeCrypto.createHash("sha256")
    .update(JSON.stringify([request.sessionId, request.endpoint, request.token, request.cli]))
    .digest("hex");
}

export function selectCuratorProvider(settings: ServerSettings, cli: BrainCuratorRun["cli"]) {
  if (!cli || !["codex", "claude", "opencode"].includes(cli)) {
    throw new Error("The Brain has no supported extraction CLI configured.");
  }
  const driver = cli === "claude" ? "claudeAgent" : cli;
  const preferred = settings.defaultModelSelection?.instanceId;
  // Choosing this agent in Brain settings is the consent to run it. The provider's own switch
  // only decides whether chat lists and probes it, and is off by default for most agents.
  const all = Object.entries(deriveProviderInstanceConfigMap(settings)).filter(
    ([, entry]) => entry.driver === driver,
  );
  const enabled = all.filter(([, entry]) => resolveProviderInstanceEnabled(entry));
  const entries = enabled.length ? enabled : all;
  const selected = entries.find(([id]) => id === preferred) ?? entries[0];
  if (!selected) {
    throw new Error(`This computer has no ${cli} agent set up to write this Brain's notes.`);
  }
  return { instanceId: ProviderInstanceId.make(selected[0]), instance: selected[1] };
}

/**
 * Notes are routine background work, so Codex and Claude use their inexpensive text model rather
 * than the chat default. OpenCode has no universal model, only what this user's subscriptions
 * serve; curator-opencode resolves that from their own model.
 */
export function selectCuratorModel(driver: string, openCodeModel?: string): string {
  const model =
    driver === "opencode"
      ? openCodeModel
      : (DEFAULT_TEXT_GENERATION_MODEL_BY_PROVIDER[ProviderDriverKind.make(driver)] ??
        DEFAULT_MODEL);
  if (!model) {
    throw new Error(
      'Flow cannot tell which OpenCode model your subscriptions include. Run OpenCode once with the model you use, or set "model" in its config, then conversation notes resume.',
    );
  }
  return model;
}

export function selectLocalCuratorCli(settings: ServerSettings): "codex" | "claude" | "opencode" {
  const entries = Object.entries(deriveProviderInstanceConfigMap(settings));
  const preferred = settings.defaultModelSelection?.instanceId;
  const enabled = entries.filter(
    ([, entry]) =>
      resolveProviderInstanceEnabled(entry) &&
      ["codex", "claudeAgent", "opencode"].includes(entry.driver),
  );
  const driver = (enabled.find(([id]) => id === preferred) ?? enabled[0])?.[1].driver;
  if (!driver) {
    throw new Error("Enable a local Codex, Claude Code or OpenCode provider for extraction.");
  }
  if (driver === "claudeAgent") {
    return "claude";
  }
  if (driver === "opencode") {
    return "opencode";
  }
  return "codex";
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await NodeFSP.readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

const prepareClaudeSession = Effect.fn("BrainCurator.prepareClaudeSession")(function* (
  request: BrainCuratorRun,
  instance: ProviderInstanceConfig,
  environment: NodeJS.ProcessEnv,
) {
  const config = yield* decodeClaude(instance.config ?? {}).pipe(Effect.mapError(toCuratorError));
  if (yield* hasClaudeManagedMcpConfig()) {
    return yield* new CuratorError({
      message:
        "Claude Code on this computer uses an administrator-managed MCP configuration, so background extraction cannot reach the Brain. Choose another agent in Brain settings.",
    });
  }
  const claudeEnvironment = yield* makeClaudeEnvironment(config, environment);
  const home = yield* HostProcess.HomeDirectory;
  const directory = yield* Effect.tryPromise({
    try: () => NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "flow-curator-claude-")),
    catch: toCuratorError,
  });
  const close = () => NodeFSP.rm(directory, { recursive: true, force: true });
  const mcpConfigPath = NodePath.join(directory, "mcp.json");
  yield* Effect.tryPromise({
    try: () =>
      NodeFSP.writeFile(mcpConfigPath, claudeCuratorMcpConfig(request.endpoint, request.token), {
        mode: 0o600,
      }),
    catch: toCuratorError,
  }).pipe(Effect.onError(() => Effect.promise(close)));
  const session: CuratorSession = {
    launch: {
      cli: "claude",
      binaryPath: expandHomePath(config.binaryPath, home),
      environment: claudeEnvironment,
      cwd: request.cwd,
      model: selectCuratorModel("claudeAgent"),
      mcpConfigPath,
    },
    nativeSessionId: undefined,
    close,
  };
  return session;
});

const prepareCodexSession = Effect.fn("BrainCurator.prepareCodexSession")(function* (
  request: BrainCuratorRun,
  instance: ProviderInstanceConfig,
  environment: NodeJS.ProcessEnv,
) {
  const config = yield* decodeCodex(instance.config ?? {}).pipe(Effect.mapError(toCuratorError));
  const layout = yield* resolveCodexHomeLayout(config);
  yield* materializeCodexShadowHome(layout).pipe(Effect.mapError(toCuratorError));
  const codexEnvironment = layout.effectiveHomePath
    ? { ...environment, CODEX_HOME: layout.effectiveHomePath }
    : environment;
  const codexHome = codexEnvironment.CODEX_HOME ?? layout.sharedHomePath;
  const configToml = yield* Effect.tryPromise({
    try: () => readOptionalFile(NodePath.join(codexHome, "config.toml")),
    catch: toCuratorError,
  });
  // Every server the user configured is switched off for this process; only t3-code remains.
  const inheritedMcpServers = codexMcpServerNames(configToml ?? "");
  if (!inheritedMcpServers.every(isIsolatableMcpServerName)) {
    return yield* new CuratorError({
      message: "A configured MCP server name cannot be isolated for background extraction.",
    });
  }
  const home = yield* HostProcess.HomeDirectory;
  const session: CuratorSession = {
    launch: {
      cli: "codex",
      binaryPath: expandHomePath(config.binaryPath, home),
      environment: codexEnvironment,
      cwd: request.cwd,
      model: selectCuratorModel("codex"),
      launchArgs: codexExecLaunchArgs(resolveCodexLaunchArgs(config.launchArgs, codexEnvironment)),
      inheritedMcpServers,
    },
    nativeSessionId: undefined,
    close: async () => {},
  };
  return session;
});

const prepareOpenCodeSession = Effect.fn("BrainCurator.prepareOpenCodeSession")(function* (
  instanceId: ProviderInstanceId,
  instance: ProviderInstanceConfig,
  environment: NodeJS.ProcessEnv,
  settings: ServerSettings,
) {
  const config = yield* decodeOpenCode(instance.config ?? {}).pipe(Effect.mapError(toCuratorError));
  if (config.serverUrl) {
    return yield* new CuratorError({
      message:
        "Background extraction requires a local OpenCode provider so its tools and history can be isolated. Choose an OpenCode instance without a Server URL.",
    });
  }
  const home = yield* HostProcess.HomeDirectory;
  const binaryPath = expandHomePath(config.binaryPath, home);
  const chosenModel =
    settings.defaultModelSelection?.instanceId === instanceId
      ? settings.defaultModelSelection.model
      : undefined;
  const isolated = yield* Effect.tryPromise({
    try: () => prepareOpenCodeCurator(environment, { binaryPath, chosenModel }),
    catch: toCuratorError,
  });
  const model = yield* Effect.try({
    try: () => selectCuratorModel("opencode", isolated.model),
    catch: toCuratorError,
  }).pipe(Effect.onError(() => Effect.promise(isolated.close)));
  const session: CuratorSession = {
    launch: {
      cli: "opencode",
      binaryPath,
      environment: isolated.environment,
      cwd: isolated.directory,
      model,
    },
    nativeSessionId: undefined,
    close: isolated.close,
  };
  return session;
});

const prepareCuratorSession = Effect.fn("BrainCurator.prepareSession")(function* (
  request: BrainCuratorRun,
  settings: ServerSettings,
  selected: ReturnType<typeof selectCuratorProvider>,
) {
  const { instanceId, instance } = selected;
  const environment = yield* mergeProviderInstanceEnvironment(instance.environment);
  // The Brain host's admin token is never needed by an agent process.
  delete environment.FLOW_ADMIN_TOKEN;
  if (instance.driver === "claudeAgent") {
    return yield* prepareClaudeSession(request, instance, environment);
  }
  if (instance.driver === "opencode") {
    return yield* prepareOpenCodeSession(instanceId, instance, environment, settings);
  }
  return yield* prepareCodexSession(request, instance, environment);
});

async function runCuratorTurn(
  session: CuratorSession,
  request: BrainCuratorRun,
  platform: NodeJS.Platform,
): Promise<BrainCuratorResult> {
  const { launch } = session;
  const command = curatorCommand(launch, {
    instructions: request.instructions,
    endpoint: request.endpoint,
    token: request.token,
    nativeSessionId: session.nativeSessionId,
  });
  const parser = new CuratorTurnParser(launch.cli);
  const exit = await runCuratorProcess(launch.binaryPath, command.args, {
    cwd: launch.cwd,
    environment: command.environment,
    input: request.input,
    signal: request.signal,
    timeoutMs: request.timeoutMs ?? DEFAULT_TURN_TIMEOUT_MS,
    platform,
    onLine: (line) => parser.accept(line),
  });
  return parser.finish(exit, session.nativeSessionId);
}

/**
 * Runs Brain curation through the selected provider's own CLI, one process per turn, and keeps
 * each conversation's native session warm so later turns resume it instead of resending context.
 */
export const makeBrainCurator = Effect.gen(function* () {
  const analytics = yield* AnalyticsService;
  const platform = yield* HostProcess.Platform;
  const context = yield* Effect.context<
    Effect.Services<ReturnType<typeof prepareCuratorSession>> | ServerSettingsService
  >();
  const run = Effect.runPromiseWith(context);
  const sessions = new CuratorSessions<CuratorSession>((session) => session.close());
  yield* Effect.addFinalizer(() => Effect.promise(() => sessions.dispose()));
  const recordCompletion = (properties: Readonly<Record<string, unknown>>) =>
    run(analytics.record("brain.curation.completed", properties)).catch(() => {});
  const execute: BrainCuratorRunner = async (request) => {
    const settings = await run(
      Effect.flatMap(ServerSettingsService, (service) => service.getSettings),
    );
    const selected = selectCuratorProvider(settings, request.cli);
    // A provider/configuration change needs fresh bounded source context, not a delta
    // delivered into the previous CLI's native conversation.
    const sessionKey =
      curatorSessionKey(request) +
      NodeCrypto.createHash("sha256")
        .update(JSON.stringify([selected, settings.defaultModelSelection]))
        .digest("hex");
    const session = await sessions.acquire(sessionKey, request.renew, () =>
      run(
        prepareCuratorSession(request, settings, selected),
        request.signal ? { signal: request.signal } : undefined,
      ),
    );
    if (!session) {
      await recordCompletion({ success: true, renewed: request.renew, requiresContext: true });
      return { requiresContext: true };
    }
    try {
      const result = await runCuratorTurn(session, request, platform);
      session.nativeSessionId = result.nativeThreadId;
      await recordCompletion({
        success: true,
        renewed: request.renew,
        requiresContext: false,
        assistantCharacters: result.assistantCharacters,
        ...(result.inputTokens === undefined ? {} : { inputTokens: result.inputTokens }),
        ...(result.cachedInputTokens === undefined
          ? {}
          : { cachedInputTokens: result.cachedInputTokens }),
        ...(result.outputTokens === undefined ? {} : { outputTokens: result.outputTokens }),
      });
      return result;
    } catch (error) {
      await recordCompletion({ success: false, renewed: request.renew, requiresContext: false });
      await sessions.discard(sessionKey);
      throw error;
    } finally {
      sessions.release(sessionKey);
    }
  };
  return execute;
});
