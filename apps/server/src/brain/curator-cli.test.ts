import { describe, expect, it } from "vite-plus/test";

import {
  CODEX_CURATOR_TOKEN_VARIABLE,
  CuratorTurnParser,
  claudeCuratorMcpConfig,
  codexMcpServerNames,
  curatorCommand,
  isIsolatableMcpServerName,
  type CuratorLaunch,
} from "./curator-cli.ts";

const base = { binaryPath: "agent", environment: { PATH: "/bin" }, cwd: "/brain", model: "light" };
const firstTurn = {
  instructions: "Keep the notes.",
  endpoint: "http://127.0.0.1:9/v1/curator/mcp/chat",
  token: "secret-token",
  nativeSessionId: undefined,
};
const resumedTurn = { ...firstTurn, nativeSessionId: "native-1" };

const valueAfter = (args: ReadonlyArray<string>, flag: string) => args[args.indexOf(flag) + 1];

function parse(cli: CuratorLaunch["cli"], events: ReadonlyArray<unknown>, exitCode = 0) {
  const parser = new CuratorTurnParser(cli);
  for (const event of events) {
    parser.accept(typeof event === "string" ? event : JSON.stringify(event));
  }
  return () => parser.finish({ exitCode, stderrTail: "" }, undefined);
}

describe("curator command lines", () => {
  it("gives Claude only the t3-code server and resumes its native session", () => {
    const launch: CuratorLaunch = { ...base, cli: "claude", mcpConfigPath: "/private/mcp.json" };
    const first = curatorCommand(launch, firstTurn).args;
    expect(first).toContain("--strict-mcp-config");
    expect(valueAfter(first, "--mcp-config")).toBe("/private/mcp.json");
    expect(valueAfter(first, "--allowedTools")).toBe("mcp__t3-code");
    expect(valueAfter(first, "--disallowedTools")?.split(",")).toEqual(
      expect.arrayContaining([
        "Bash",
        "Write",
        "Edit",
        "NotebookEdit",
        "WebFetch",
        "WebSearch",
        "Task",
      ]),
    );
    expect(valueAfter(first, "--tools")).toBe("");
    expect(valueAfter(first, "--system-prompt")).toBe("Keep the notes.");
    expect(first).not.toContain("--resume");
    expect(first.join(" ")).not.toContain("secret-token");
    expect(valueAfter(curatorCommand(launch, resumedTurn).args, "--resume")).toBe("native-1");
    expect(JSON.parse(claudeCuratorMcpConfig(firstTurn.endpoint, firstTurn.token))).toEqual({
      mcpServers: {
        "t3-code": {
          type: "http",
          url: firstTurn.endpoint,
          headers: { Authorization: "Bearer secret-token" },
        },
      },
    });
  });

  it("switches off the user's Codex servers and passes the token only through the environment", () => {
    const launch: CuratorLaunch = {
      ...base,
      cli: "codex",
      launchArgs: ["-c", 'model_provider="openai"'],
      inheritedMcpServers: ["github", "docs"],
    };
    const first = curatorCommand(launch, firstTurn);
    const overrides = first.args.flatMap((arg, index) =>
      first.args[index - 1] === "-c" ? [arg] : [],
    );
    expect(first.args.slice(0, 2)).toEqual(["exec", "--json"]);
    expect(valueAfter(first.args, "--sandbox")).toBe("read-only");
    expect(first.args).toContain("--skip-git-repo-check");
    expect(overrides).toEqual(
      expect.arrayContaining([
        "features.shell_tool=false",
        'model_reasoning_effort="low"',
        "mcp_servers.github.enabled=false",
        "mcp_servers.docs.enabled=false",
        `mcp_servers.t3-code.url="${firstTurn.endpoint}"`,
        `mcp_servers.t3-code.bearer_token_env_var="${CODEX_CURATOR_TOKEN_VARIABLE}"`,
        `developer_instructions="Keep the notes."`,
      ]),
    );
    // The instance's own overrides come first, so the curator's later ones win.
    expect(overrides.indexOf('model_provider="openai"')).toBe(0);
    expect(first.args.join(" ")).not.toContain("secret-token");
    expect(first.environment[CODEX_CURATOR_TOKEN_VARIABLE]).toBe("secret-token");
    expect(first.args.at(-1)).toBe("-");
    expect(curatorCommand(launch, resumedTurn).args.slice(-3)).toEqual(["resume", "native-1", "-"]);
  });

  it("adds the Brain server and curator prompt to OpenCode's isolated config", () => {
    const isolated = JSON.stringify({ mcp: {}, permission: { "*": "deny", "t3-code_*": "allow" } });
    const launch: CuratorLaunch = {
      ...base,
      cli: "opencode",
      environment: { OPENCODE_CONFIG_CONTENT: isolated },
    };
    const first = curatorCommand(launch, firstTurn);
    expect(first.args).toEqual([
      "run",
      "--format",
      "json",
      "-m",
      "light",
      "--agent",
      "flow-curator",
    ]);
    expect(JSON.parse(first.environment.OPENCODE_CONFIG_CONTENT!)).toEqual({
      permission: { "*": "deny", "t3-code_*": "allow" },
      mcp: {
        "t3-code": {
          type: "remote",
          url: firstTurn.endpoint,
          headers: { Authorization: "Bearer secret-token" },
          oauth: false,
          enabled: true,
        },
      },
      agent: { "flow-curator": { mode: "primary", model: "light", prompt: "Keep the notes." } },
    });
    expect(curatorCommand(launch, resumedTurn).args.slice(-2)).toEqual(["--session", "native-1"]);
  });

  it("finds every MCP server a Codex config declares", () => {
    const config = [
      'model = "gpt"',
      'mcp_servers.inline.command = "x"',
      "[mcp_servers.github]",
      'command = "gh"',
      "[mcp_servers.github.env]",
      'TOKEN = "x"',
      '[mcp_servers."dotted.name"]',
      "[mcp_servers]",
      'docs = { url = "https://docs" }',
      "[mcp_servers.t3-code]",
      "[profiles.fast]",
      'model = "mini"',
    ].join("\n");
    expect(codexMcpServerNames(config).toSorted()).toEqual(
      ['"dotted.name"', "docs", "github", "inline"].toSorted(),
    );
    expect(codexMcpServerNames(config).filter((name) => !isIsolatableMcpServerName(name))).toEqual([
      '"dotted.name"',
    ]);
  });
});

describe("curator event streams", () => {
  it.each([
    [
      "claude",
      [
        "not json",
        { type: "system", subtype: "init", session_id: "claude-1" },
        { type: "assistant", message: { content: [{ type: "text", text: "noted" }] } },
        {
          type: "result",
          subtype: "success",
          is_error: false,
          session_id: "claude-1",
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 80,
            cache_creation_input_tokens: 5,
            output_tokens: 20,
          },
        },
      ],
      {
        nativeThreadId: "claude-1",
        assistantCharacters: 5,
        inputTokens: 95,
        cachedInputTokens: 80,
        outputTokens: 20,
      },
    ],
    [
      "codex",
      [
        { type: "thread.started", thread_id: "codex-1" },
        { type: "error", message: "Reconnecting... 1/5" },
        { type: "item.completed", item: { type: "agent_message", text: "noted" } },
        { type: "item.completed", item: { type: "reasoning", text: "ignored" } },
        {
          type: "turn.completed",
          usage: { input_tokens: 90, cached_input_tokens: 80, output_tokens: 20 },
        },
      ],
      {
        nativeThreadId: "codex-1",
        assistantCharacters: 5,
        inputTokens: 90,
        cachedInputTokens: 80,
        outputTokens: 20,
      },
    ],
    [
      "opencode",
      [
        { type: "step_start", sessionID: "ses_1" },
        { type: "text", sessionID: "ses_1", part: { text: "noted" } },
        {
          type: "step_finish",
          sessionID: "ses_1",
          part: { tokens: { input: 10, output: 5, reasoning: 1, cache: { read: 40, write: 2 } } },
        },
        {
          type: "step_finish",
          sessionID: "ses_1",
          part: { tokens: { input: 3, output: 4, reasoning: 0, cache: { read: 50, write: 0 } } },
        },
      ],
      {
        nativeThreadId: "ses_1",
        assistantCharacters: 5,
        inputTokens: 105,
        cachedInputTokens: 90,
        outputTokens: 10,
      },
    ],
  ] as const)("reads a completed %s turn", (cli, events, expected) => {
    expect(parse(cli, events)()).toEqual(expected);
  });

  it.each([
    [
      "claude",
      [
        { type: "system", subtype: "init", session_id: "claude-1" },
        {
          type: "result",
          subtype: "success",
          is_error: true,
          result: "Claude AI usage limit reached",
        },
      ],
      1,
      "Claude AI usage limit reached",
    ],
    [
      "codex",
      [
        { type: "thread.started", thread_id: "codex-1" },
        { type: "turn.failed", error: { message: "unexpected status 401 Unauthorized" } },
      ],
      1,
      "unexpected status 401 Unauthorized",
    ],
    [
      "opencode",
      [
        {
          type: "error",
          sessionID: "ses_1",
          error: { name: "APIError", data: { message: "Model not found" } },
        },
      ],
      0,
      "Model not found",
    ],
    ["codex", [{ type: "thread.started", thread_id: "codex-1" }], 0, /Codex could not complete/],
  ] as const)("reports the provider's own failure for %s", (cli, events, exitCode, message) => {
    expect(parse(cli, events, exitCode)).toThrow(message);
  });

  it("recognises a sign-out on stderr without forwarding stderr", () => {
    const parser = new CuratorTurnParser("claude");
    const finish = () =>
      parser.finish({ exitCode: 1, stderrTail: "Not logged in. token=abc123" }, undefined);
    expect(finish).toThrow(/Claude Code is signed out/);
    expect(finish).not.toThrow(/abc123/);
  });

  it("keeps the known native session when a resumed turn does not repeat it", () => {
    const parser = new CuratorTurnParser("codex");
    parser.accept(JSON.stringify({ type: "turn.completed", usage: {} }));
    expect(parser.finish({ exitCode: 0, stderrTail: "" }, "codex-1").nativeThreadId).toBe(
      "codex-1",
    );
    expect(() => parser.finish({ exitCode: 0, stderrTail: "" }, undefined)).toThrow(
      /did not create a background extraction session/,
    );
  });
});
