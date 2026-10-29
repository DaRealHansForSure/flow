import type { BrainCuratorCli, BrainCuratorResult } from "@flow/brain-runtime";

import { classifyAgentIssue } from "./agent-issue.ts";

/** Codex reads the Brain token from this variable, so it never appears in an argument list. */
export const CODEX_CURATOR_TOKEN_VARIABLE = "FLOW_CURATOR_MCP_TOKEN";
const OPENCODE_CURATOR_AGENT = "flow-curator";
const MCP_SERVER_NAME = "t3-code";
const PROVIDER_ERROR_CHARACTERS = 600;

const CLI_NAMES: Record<BrainCuratorCli, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
};

// Appended after the instance's launch options and never written to its config.
const CODEX_CURATOR_FLAGS = [
  'history.persistence="none"',
  "features.shell_tool=false",
  "features.multi_agent=false",
  "features.apps=false",
  "features.plugins=false",
  'web_search="disabled"',
  "model_auto_compact_token_limit=100000",
  'model_reasoning_effort="low"',
  'approval_policy="never"',
  // AGENTS.md in the Brain workspace belongs to the indexer, not to curation.
  "project_doc_max_bytes=0",
];

const CLAUDE_DISALLOWED_TOOLS = "Bash,Write,Edit,NotebookEdit,WebFetch,WebSearch,Task";

interface CuratorLaunchBase {
  readonly binaryPath: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly cwd: string;
  readonly model: string;
}

/** Everything a curator session fixes once; each turn adds instructions and its native session. */
export type CuratorLaunch =
  | (CuratorLaunchBase & { readonly cli: "claude"; readonly mcpConfigPath: string })
  | (CuratorLaunchBase & {
      readonly cli: "codex";
      readonly launchArgs: ReadonlyArray<string>;
      readonly inheritedMcpServers: ReadonlyArray<string>;
    })
  | (CuratorLaunchBase & { readonly cli: "opencode" });

interface CuratorTurn {
  readonly instructions: string;
  readonly endpoint: string;
  readonly token: string;
  /** The native session to continue; absent for the first turn of a session. */
  readonly nativeSessionId: string | undefined;
}

interface CuratorCommand {
  readonly args: ReadonlyArray<string>;
  readonly environment: NodeJS.ProcessEnv;
}

/** The file Claude reads through `--mcp-config`; it holds the token, so it stays private. */
export function claudeCuratorMcpConfig(endpoint: string, token: string): string {
  return JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: "http",
        url: endpoint,
        headers: { Authorization: `Bearer ${token}` },
      },
    },
  });
}

/** The command line and environment for one curation turn. The turn's input goes to stdin. */
export function curatorCommand(launch: CuratorLaunch, turn: CuratorTurn): CuratorCommand {
  if (launch.cli === "claude") {
    return { args: claudeCuratorArgs(launch, turn), environment: launch.environment };
  }
  if (launch.cli === "codex") {
    return {
      args: codexCuratorArgs(launch, turn),
      environment: { ...launch.environment, [CODEX_CURATOR_TOKEN_VARIABLE]: turn.token },
    };
  }
  return {
    args: openCodeCuratorArgs(launch, turn),
    environment: {
      ...launch.environment,
      OPENCODE_CONFIG_CONTENT: openCodeCuratorConfigContent(
        launch.environment.OPENCODE_CONFIG_CONTENT,
        launch.model,
        turn,
      ),
    },
  };
}

function claudeCuratorArgs(
  launch: Extract<CuratorLaunch, { cli: "claude" }>,
  turn: CuratorTurn,
): string[] {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    launch.model,
    "--system-prompt",
    turn.instructions,
    "--mcp-config",
    launch.mcpConfigPath,
    "--strict-mcp-config",
    "--settings",
    JSON.stringify({ disableAllHooks: true }),
    "--disable-slash-commands",
    "--permission-mode",
    "dontAsk",
    "--tools",
    "",
    "--allowedTools",
    `mcp__${MCP_SERVER_NAME}`,
    "--disallowedTools",
    CLAUDE_DISALLOWED_TOOLS,
  ];
  if (turn.nativeSessionId) {
    args.push("--resume", turn.nativeSessionId);
  }
  return args;
}

function codexCuratorArgs(
  launch: Extract<CuratorLaunch, { cli: "codex" }>,
  turn: CuratorTurn,
): string[] {
  const overrides = [
    ...CODEX_CURATOR_FLAGS,
    `developer_instructions=${JSON.stringify(turn.instructions)}`,
    ...launch.inheritedMcpServers.map((name) => `mcp_servers.${name}.enabled=false`),
    `mcp_servers.${MCP_SERVER_NAME}.url=${JSON.stringify(turn.endpoint)}`,
    `mcp_servers.${MCP_SERVER_NAME}.bearer_token_env_var="${CODEX_CURATOR_TOKEN_VARIABLE}"`,
    `mcp_servers.${MCP_SERVER_NAME}.enabled=true`,
  ];
  const args = [
    "exec",
    "--json",
    ...launch.launchArgs,
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "-m",
    launch.model,
    ...overrides.flatMap((override) => ["-c", override]),
  ];
  if (turn.nativeSessionId) {
    args.push("resume", turn.nativeSessionId);
  }
  // "-" reads the turn from stdin.
  args.push("-");
  return args;
}

function openCodeCuratorArgs(
  launch: Extract<CuratorLaunch, { cli: "opencode" }>,
  turn: CuratorTurn,
): string[] {
  const args = ["run", "--format", "json", "-m", launch.model, "--agent", OPENCODE_CURATOR_AGENT];
  if (turn.nativeSessionId) {
    args.push("--session", turn.nativeSessionId);
  }
  return args;
}

/** Adds the Brain server and the curator agent to the isolated configuration from curator-opencode. */
function openCodeCuratorConfigContent(
  isolatedConfig: string | undefined,
  model: string,
  turn: Pick<CuratorTurn, "instructions" | "endpoint" | "token">,
): string {
  const config = asRecord(isolatedConfig ? JSON.parse(isolatedConfig) : {});
  return JSON.stringify({
    ...config,
    mcp: {
      [MCP_SERVER_NAME]: {
        type: "remote",
        url: turn.endpoint,
        headers: { Authorization: `Bearer ${turn.token}` },
        oauth: false,
        enabled: true,
      },
    },
    agent: {
      [OPENCODE_CURATOR_AGENT]: { mode: "primary", model, prompt: turn.instructions },
    },
  });
}

/**
 * MCP server names a Codex config.toml declares, from `[mcp_servers.<name>]` headers, dotted
 * `mcp_servers.<name>.key` lines and keys of an `[mcp_servers]` table. Quoted names are returned
 * with their quotes so the caller can refuse names a `-c` override cannot address.
 */
export function codexMcpServerNames(configToml: string): string[] {
  const names = new Set<string>();
  const name = String.raw`("[^"]*"|'[^']*'|[^\s."'=\]]+)`;
  const nestedHeader = new RegExp(String.raw`^mcp_servers\s*\.\s*${name}`);
  const dottedKey = new RegExp(String.raw`^\s*mcp_servers\s*\.\s*${name}`);
  const tableKey = new RegExp(String.raw`^\s*${name}\s*[.=]`);
  let isInsideServersTable = false;
  for (const line of configToml.split(/\r?\n/)) {
    const header = /^\s*\[\s*([^\]]+?)\s*\]/.exec(line);
    if (header) {
      const path = header[1]!;
      isInsideServersTable = path === "mcp_servers";
      const nested = nestedHeader.exec(path);
      if (nested) {
        names.add(nested[1]!);
      }
      continue;
    }
    const key = (isInsideServersTable ? tableKey : dottedKey).exec(line);
    if (key) {
      names.add(key[1]!);
    }
  }
  names.delete(MCP_SERVER_NAME);
  return [...names];
}

/** Codex's -c parser splits dotted keys itself; a TOML-quoted key names a different server. */
export function isIsolatableMcpServerName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export interface CuratorProcessExit {
  readonly exitCode: number | null;
  readonly stderrTail: string;
}

interface TokenUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

type ReadTokenUsage = { readonly [Field in keyof TokenUsage]-?: number | undefined };

/** Reads one turn's JSON event stream into a BrainCuratorResult or a failure message. */
export class CuratorTurnParser {
  private readonly cli: BrainCuratorCli;
  private nativeSessionId: string | undefined;
  private assistantCharacters = 0;
  private usage: TokenUsage = {};
  private isCompleted = false;
  private hasFailed = false;
  private providerError: string | undefined;

  constructor(cli: BrainCuratorCli) {
    this.cli = cli;
  }

  accept(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Banners and progress text are not events.
      return;
    }
    const event = asRecord(parsed);
    if (this.cli === "claude") {
      this.acceptClaude(event);
    } else if (this.cli === "codex") {
      this.acceptCodex(event);
    } else {
      this.acceptOpenCode(event);
    }
  }

  /** The turn's result, or an Error that says why the provider did not complete it. */
  finish(exit: CuratorProcessExit, previousSessionId: string | undefined): BrainCuratorResult {
    let isCompleted = this.isCompleted;
    if (this.cli === "opencode") {
      // OpenCode has no completion event; a clean exit without an error event is its success.
      isCompleted = this.providerError === undefined;
    }
    const succeeded = exit.exitCode === 0 && isCompleted && !this.hasFailed;
    if (!succeeded) {
      throw new Error(this.failureMessage(exit));
    }
    const nativeThreadId = this.nativeSessionId ?? previousSessionId;
    if (!nativeThreadId) {
      throw new Error("The selected provider did not create a background extraction session.");
    }
    return { nativeThreadId, assistantCharacters: this.assistantCharacters, ...this.usage };
  }

  private failureMessage(exit: CuratorProcessExit): string {
    if (this.providerError) {
      return this.providerError;
    }
    const issue = classifyAgentIssue(exit.stderrTail, this.cli, "Notes");
    if (issue) {
      return issue.message;
    }
    // stderr is never forwarded: auth helpers and providers can include credentials in it.
    return `${CLI_NAMES[this.cli]} could not complete background extraction (exit ${exit.exitCode ?? "signal"}).`;
  }

  private rememberSession(value: unknown): void {
    if (this.nativeSessionId === undefined && typeof value === "string" && value) {
      this.nativeSessionId = value;
    }
  }

  private rememberError(message: unknown, fallback: string): void {
    let text = fallback;
    if (typeof message === "string" && message.trim()) {
      text = message.trim();
    }
    this.providerError = text.slice(0, PROVIDER_ERROR_CHARACTERS);
  }

  private acceptClaude(event: Record<string, unknown>): void {
    this.rememberSession(event.session_id);
    if (event.type === "assistant") {
      const content = asRecord(event.message).content;
      for (const block of Array.isArray(content) ? content : []) {
        const part = asRecord(block);
        if (part.type === "text" && typeof part.text === "string") {
          this.assistantCharacters += part.text.length;
        }
      }
    } else if (event.type === "rate_limit_event") {
      if (asRecord(event.rate_limit_info).status === "rejected") {
        this.rememberError(undefined, "Claude Code reached its usage limit.");
      }
    } else if (event.type === "result") {
      this.isCompleted = event.subtype === "success" && event.is_error !== true;
      if (!this.isCompleted) {
        this.hasFailed = true;
        const errors = Array.isArray(event.errors) ? event.errors.join(" ") : undefined;
        const reason = typeof event.result === "string" ? event.result : errors;
        this.rememberError(
          reason,
          `Claude Code stopped background extraction (${String(event.subtype)}).`,
        );
      }
      const usage = asRecord(event.usage);
      const uncached = countOf(usage.input_tokens);
      const cacheRead = countOf(usage.cache_read_input_tokens);
      const cacheCreation = countOf(usage.cache_creation_input_tokens);
      // Claude counts cache reads and writes apart from input; Brain usage reports all input.
      let inputTokens: number | undefined;
      if (uncached !== undefined) {
        inputTokens = uncached + (cacheRead ?? 0) + (cacheCreation ?? 0);
      }
      this.usage = definedUsage({
        inputTokens,
        cachedInputTokens: cacheRead,
        outputTokens: countOf(usage.output_tokens),
      });
    }
  }

  private acceptCodex(event: Record<string, unknown>): void {
    if (event.type === "thread.started") {
      this.rememberSession(event.thread_id);
    } else if (event.type === "item.completed") {
      const item = asRecord(event.item);
      if (item.type === "agent_message" && typeof item.text === "string") {
        this.assistantCharacters += item.text.length;
      }
    } else if (event.type === "turn.completed") {
      this.isCompleted = true;
      const usage = asRecord(event.usage);
      this.usage = definedUsage({
        inputTokens: countOf(usage.input_tokens),
        cachedInputTokens: countOf(usage.cached_input_tokens),
        outputTokens: countOf(usage.output_tokens),
      });
    } else if (event.type === "turn.failed") {
      this.hasFailed = true;
      this.rememberError(asRecord(event.error).message, "Codex stopped background extraction.");
    } else if (event.type === "error") {
      // Codex also reports retried stream errors here; only a turn without completion fails.
      this.rememberError(event.message, "Codex reported an error during background extraction.");
    }
  }

  private acceptOpenCode(event: Record<string, unknown>): void {
    this.rememberSession(event.sessionID);
    const part = asRecord(event.part);
    if (event.type === "text" && typeof part.text === "string") {
      this.assistantCharacters += part.text.length;
    } else if (event.type === "step_finish") {
      const tokens = asRecord(part.tokens);
      const cache = asRecord(tokens.cache);
      const cacheRead = countOf(cache.read) ?? 0;
      const input = (countOf(tokens.input) ?? 0) + cacheRead + (countOf(cache.write) ?? 0);
      const output = (countOf(tokens.output) ?? 0) + (countOf(tokens.reasoning) ?? 0);
      this.usage = {
        inputTokens: (this.usage.inputTokens ?? 0) + input,
        cachedInputTokens: (this.usage.cachedInputTokens ?? 0) + cacheRead,
        outputTokens: (this.usage.outputTokens ?? 0) + output,
      };
    } else if (event.type === "error") {
      const error = asRecord(event.error);
      this.rememberError(
        asRecord(error.data).message ?? error.message,
        "OpenCode reported an error during background extraction.",
      );
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function countOf(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  return undefined;
}

function definedUsage(usage: ReadTokenUsage): TokenUsage {
  const defined: TokenUsage = {};
  if (usage.inputTokens !== undefined) {
    defined.inputTokens = usage.inputTokens;
  }
  if (usage.cachedInputTokens !== undefined) {
    defined.cachedInputTokens = usage.cachedInputTokens;
  }
  if (usage.outputTokens !== undefined) {
    defined.outputTokens = usage.outputTokens;
  }
  return defined;
}
