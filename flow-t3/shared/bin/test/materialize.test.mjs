import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";
import { parse } from "jsonc-parser";

const materializer = new URL("../lib/materialize.mjs", import.meta.url).href;

for (const harness of ["opencode", "gemini", "antigravity"]) {
  NodeTest.test(`${harness}-only setup installs and restores shared knowledge without Codex`, () => fixture(({ repoDir, invoke }) => {
    const skill = NodePath.join(repoDir, ".agents/skills/flow/SKILL.md");
    NodeFS.mkdirSync(NodePath.join(repoDir, ".agents/skills/flow"), { recursive: true });
    NodeFS.writeFileSync(skill, "Existing skill\n");
    NodeFS.writeFileSync(NodePath.join(repoDir, "AGENTS.md"), "Existing instructions\n");
    invoke(`m.materializeRepo({ ...ctx, harnesses: [${JSON.stringify(harness)}] });`);
    NodeAssert.match(NodeFS.readFileSync(skill, "utf8"), /test-project/);
    NodeAssert.match(NodeFS.readFileSync(NodePath.join(repoDir, "AGENTS.md"), "utf8"), /flow setup test-project/);
    NodeAssert.ok(!NodeFS.existsSync(NodePath.join(repoDir, ".codex")));
    invoke("m.removeRepo(ctx.repoDir)");
    NodeAssert.equal(NodeFS.readFileSync(skill, "utf8"), "Existing skill\n");
    NodeAssert.equal(NodeFS.readFileSync(NodePath.join(repoDir, "AGENTS.md"), "utf8"), "Existing instructions\n");
  }));
}

NodeTest.test("adding a harness retains earlier exclusions and removes both integrations", () => fixture(({ repoDir, invoke }) => {
  invoke("m.materializeRepo(ctx); m.materializeRepo({ ...ctx, harnesses: ['codex'] });");
  const ignored = NodeChildProcess.spawnSync("git", ["check-ignore", ".github/mcp.json", ".codex/config.toml"], { cwd: repoDir, encoding: "utf8" });
  NodeAssert.equal(ignored.stdout.trim().split("\n").length, 2);
  invoke("m.removeRepo(ctx.repoDir)");
  NodeAssert.ok(!NodeFS.existsSync(NodePath.join(repoDir, ".github/mcp.json")));
  NodeAssert.ok(!NodeFS.existsSync(NodePath.join(repoDir, ".codex/config.toml")));
}));

function fixture(run) {
  const home = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "flow-materialize-"));
  const repoDir = NodePath.join(home, "repo with spaces");
  NodeFS.mkdirSync(repoDir);
  const git = NodeChildProcess.spawnSync("git", ["init", "-q", repoDir]);
  NodeAssert.equal(git.status, 0);
  const ctx = { repoDir, project: "test-project", repo: "test-repo", harnesses: ["copilot"] };
  function invoke(code, extraEnv = {}) {
    const result = NodeChildProcess.spawnSync(process.execPath, ["--input-type=module", "-e", `
      import * as m from ${JSON.stringify(materializer)};
      const ctx = ${JSON.stringify(ctx)};
      ${code}
    `], { env: { ...process.env, HOME: home, COPILOT_HOME: "", ...extraEnv }, encoding: "utf8" });
    NodeAssert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  try { run({ home, repoDir, invoke }); }
  finally { NodeFS.rmSync(home, { recursive: true, force: true }); }
}

NodeTest.test("Copilot setup, repeated setup, and removal preserve user configuration", () => fixture(({ repoDir, invoke }) => {
  const originals = {
    ".vscode/mcp.json": '{\n  // My existing server\n  "servers": { "mine": { "command": "my-server" }, },\n  "inputs": [],\n}\n',
    ".github/mcp.json": '{"mcpServers":{"mine":{"command":"my-cli-server"}}}\n',
    ".github/hooks/flow.json": '{"version":1,"hooks":{"Stop":[{"type":"command","command":"my-hook"}]}}\n',
    ".github/copilot-instructions.md": "# Team rules\n\nKeep public APIs stable.\n",
    ".github/skills/flow/SKILL.md": "An existing personal skill.\n",
  };
  for (const [rel, content] of Object.entries(originals)) {
    const p = NodePath.join(repoDir, rel);
    NodeFS.mkdirSync(NodePath.join(p, ".."), { recursive: true });
    NodeFS.writeFileSync(p, content);
  }
  invoke("m.materializeRepo(ctx)");
  const installed = Object.fromEntries(Object.keys(originals).map((rel) => [rel, NodeFS.readFileSync(NodePath.join(repoDir, rel), "utf8")]));
  const vscode = parse(installed[".vscode/mcp.json"]);
  NodeAssert.equal(vscode.servers.mine.command, "my-server");
  NodeAssert.equal(vscode.servers["flow-graph"].command, process.execPath);
  NodeAssert.equal(vscode.servers["flow-graph"].type, "stdio");
  NodeAssert.ok(installed[".vscode/mcp.json"].includes("// My existing server"));
  const cli = parse(installed[".github/mcp.json"]);
  NodeAssert.deepEqual(cli.mcpServers["flow-graph"], vscode.servers["flow-graph"]);
  const hooks = parse(installed[".github/hooks/flow.json"]);
  NodeAssert.deepEqual(Object.keys(hooks.hooks).sort(), ["PostToolUse", "SessionEnd", "SessionStart", "Stop", "UserPromptSubmit"]);
  NodeAssert.equal(hooks.hooks.Stop.length, 2);
  NodeAssert.match(hooks.hooks.Stop[1].command, /'--harness' 'copilot'/);
  NodeAssert.ok(!NodeFS.existsSync(NodePath.join(repoDir, ".claude")), "Copilot installs independently of Claude");
  NodeAssert.match(NodeFS.readFileSync(NodePath.join(repoDir, ".git/info/exclude"), "utf8"), /\.github\/hooks\/flow.json/);
  invoke("m.materializeRepo(ctx)");
  for (const [rel, text] of Object.entries(installed)) NodeAssert.equal(NodeFS.readFileSync(NodePath.join(repoDir, rel), "utf8"), text);
  invoke("m.removeRepo(ctx.repoDir)");
  for (const [rel, text] of Object.entries(originals)) NodeAssert.equal(NodeFS.readFileSync(NodePath.join(repoDir, rel), "utf8"), text, rel);
}));

NodeTest.test("removal keeps servers added after setup and deletes empty generated files", () => fixture(({ repoDir, invoke }) => {
  invoke("m.materializeRepo(ctx)");
  const path = NodePath.join(repoDir, ".vscode/mcp.json");
  const file = parse(NodeFS.readFileSync(path, "utf8"));
  file.servers.later = { command: "later-server" };
  NodeFS.writeFileSync(path, JSON.stringify(file));
  invoke("m.removeRepo(ctx.repoDir)");
  NodeAssert.deepEqual(parse(NodeFS.readFileSync(path, "utf8")), { servers: { later: { command: "later-server" } } });
  NodeAssert.ok(!NodeFS.existsSync(NodePath.join(repoDir, ".github")));
}));

NodeTest.test("bare CLI server maps and shared mode are supported", () => fixture(({ repoDir, invoke }) => {
  NodeFS.mkdirSync(NodePath.join(repoDir, ".github"));
  const path = NodePath.join(repoDir, ".github/mcp.json");
  const original = '{"mine":{"command":"server"}}\n';
  NodeFS.writeFileSync(path, original);
  invoke("m.materializeRepo({ ...ctx, share: true })");
  NodeAssert.ok(parse(NodeFS.readFileSync(path, "utf8"))["flow-graph"]);
  NodeAssert.ok(!NodeFS.readFileSync(NodePath.join(repoDir, ".git/info/exclude"), "utf8").includes("flow:begin"));
  invoke("m.removeRepo(ctx.repoDir)");
  NodeAssert.equal(NodeFS.readFileSync(path, "utf8"), original);
}));

NodeTest.test("malformed Copilot config is reported without overwriting it", () => fixture(({ repoDir, invoke }) => {
  NodeFS.mkdirSync(NodePath.join(repoDir, ".github/hooks"), { recursive: true });
  const path = NodePath.join(repoDir, ".github/hooks/flow.json");
  NodeFS.writeFileSync(path, "{ broken");
  invoke(`
    import assert from "node:assert/strict";
    assert.throws(() => m.materializeRepo(ctx), /Invalid Copilot configuration/);
  `);
  NodeAssert.equal(NodeFS.readFileSync(path, "utf8"), "{ broken");
}));

NodeTest.test("comment-only Copilot MCP config is treated as empty and restored on removal", () => fixture(({ repoDir, invoke }) => {
  NodeFS.mkdirSync(NodePath.join(repoDir, ".vscode"));
  const path = NodePath.join(repoDir, ".vscode/mcp.json");
  const original = `// {
// \t"servers": {
// \t\t"landinghero-library": {
// \t\t\t"type": "http",
// \t\t\t"url": "http://localhost:8080/library-mcp"
// \t\t}
// \t},
// \t"inputs": []
// }
`;
  NodeFS.writeFileSync(path, original);
  invoke("m.materializeRepo(ctx)");
  const installed = NodeFS.readFileSync(path, "utf8");
  const parsed = parse(installed);
  NodeAssert.equal(parsed.servers["flow-graph"].type, "stdio");
  NodeAssert.ok(installed.includes("landinghero-library"));
  invoke("m.removeRepo(ctx.repoDir)");
  NodeAssert.equal(NodeFS.readFileSync(path, "utf8"), original);
}));

NodeTest.test("Copilot detection recognizes an installed VS Code extension", () => fixture(({ home, invoke }) => {
  NodeFS.mkdirSync(NodePath.join(home, ".vscode/extensions/github.copilot-chat-1.0.0"), { recursive: true });
  NodeAssert.ok(JSON.parse(invoke("console.log(JSON.stringify(m.detectHarnesses()))")).includes("copilot"));
}));

NodeTest.test("removal restores pre-existing empty config maps", () => fixture(({ repoDir, invoke }) => {
  const originals = {
    ".vscode/mcp.json": '{ "servers": {} }\n',
    ".github/mcp.json": '{ "mcpServers": {} }\n',
    ".github/hooks/flow.json": '{ "hooks": {} }\n',
  };
  for (const [rel, content] of Object.entries(originals)) {
    NodeFS.mkdirSync(NodePath.join(repoDir, rel, ".."), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(repoDir, rel), content);
  }
  invoke("m.materializeRepo(ctx); m.removeRepo(ctx.repoDir)");
  for (const [rel, content] of Object.entries(originals)) NodeAssert.equal(NodeFS.readFileSync(NodePath.join(repoDir, rel), "utf8"), content);
}));

NodeTest.test("rendered hook commands preserve spaces and shell metacharacters in bindings", () => fixture(({ home, repoDir, invoke }) => {
  invoke(`m.materializeRepo({ ...ctx, project: "project with spaces", repo: "repo's $literal" })`);
  NodeFS.mkdirSync(NodePath.join(home, ".flow/bin"), { recursive: true });
  NodeFS.writeFileSync(NodePath.join(home, ".flow/bin/flow-hook"), "console.log(JSON.stringify(process.argv.slice(2)))");
  const hooks = parse(NodeFS.readFileSync(NodePath.join(repoDir, ".github/hooks/flow.json"), "utf8"));
  const result = NodeChildProcess.spawnSync(hooks.hooks.Stop[0].command, { shell: true, encoding: "utf8" });
  NodeAssert.equal(result.status, 0, result.stderr);
  NodeAssert.deepEqual(JSON.parse(result.stdout), ["--harness", "copilot", "--project", "project with spaces", "--repo", "repo's $literal", "--remote", "local"]);
}));

NodeTest.test("removing another tool's integration leaves unrelated Copilot config alone", () => fixture(({ repoDir, invoke }) => {
  NodeFS.mkdirSync(NodePath.join(repoDir, ".vscode"));
  const path = NodePath.join(repoDir, ".vscode/mcp.json");
  NodeFS.writeFileSync(path, "{ unfinished user config");
  invoke('m.materializeRepo({ ...ctx, harnesses: ["gemini"] }); m.removeRepo(ctx.repoDir)');
  NodeAssert.equal(NodeFS.readFileSync(path, "utf8"), "{ unfinished user config");
}));


NodeTest.test("OpenCode setup isolates plugin installs and removes only its own manifest", () => fixture(({ repoDir, invoke }) => {
  const file = NodePath.join(repoDir, ".opencode/package.json");
  invoke("m.materializeRepo({ ...ctx, harnesses: ['opencode'] });");
  NodeAssert.equal(JSON.parse(NodeFS.readFileSync(file, "utf8")).dependencies["@opencode-ai/plugin"], "1.17.20");
  invoke("m.materializeRepo({ ...ctx, harnesses: ['opencode'] }); m.removeRepo(ctx.repoDir);");
  NodeAssert.ok(!NodeFS.existsSync(file));
  NodeFS.mkdirSync(NodePath.join(repoDir, ".opencode"), { recursive: true });
  const original = '{"private":true,"dependencies":{"user-plugin":"1.0.0"}}\n';
  NodeFS.writeFileSync(file, original);
  invoke("m.materializeRepo({ ...ctx, harnesses: ['opencode'] });");
  NodeAssert.equal(NodeFS.readFileSync(file, "utf8"), original);
  invoke("m.removeRepo(ctx.repoDir);");
  NodeAssert.equal(NodeFS.readFileSync(file, "utf8"), original);
}));


NodeTest.test("Antigravity lifecycle hooks use flat handlers and explicit event identity", () => fixture(({ repoDir, invoke }) => {
  invoke("m.materializeRepo({ ...ctx, harnesses: ['antigravity'] });");
  const hooks = JSON.parse(NodeFS.readFileSync(NodePath.join(repoDir, ".agents/hooks.json"), "utf8"))["flow-capture"];
  for (const name of ["PostInvocation", "Stop"]) {
    NodeAssert.equal(hooks[name][0].type, "command");
    NodeAssert.equal(hooks[name][0].hooks, undefined);
    NodeAssert.ok(hooks[name][0].command.endsWith(`--event ${name}`));
  }
}));


NodeTest.test("Antigravity MCP identities are stable per binding and do not collide across projects", () => fixture(({ repoDir, invoke }) => {
  const file = NodePath.join(repoDir, ".agents/mcp_config.json");
  NodeFS.mkdirSync(NodePath.join(repoDir, ".agents"), { recursive: true });
  const original = JSON.stringify({ mcpServers: { "flow-graph-unrelated": { command: "user-server" } } });
  NodeFS.writeFileSync(file, original);
  const render = (project = "test-project", repo = "test-repo") => {
    invoke(`m.materializeRepo({ ...ctx, project: ${JSON.stringify(project)}, repo: ${JSON.stringify(repo)}, harnesses: ['antigravity'] });`);
    const servers = JSON.parse(NodeFS.readFileSync(file, "utf8")).mcpServers;
    NodeAssert.equal(servers["flow-graph-unrelated"].command, "user-server");
    const keys = Object.keys(servers).filter(k => k !== "flow-graph-unrelated");
    NodeAssert.equal(keys.length, 1);
    NodeAssert.match(keys[0], /^flow-graph-[a-f0-9]{12}$/);
    return keys[0];
  };
  const first = render();
  const legacy = JSON.parse(NodeFS.readFileSync(file, "utf8"));
  legacy.mcpServers["flow-graph"] = legacy.mcpServers[first];
  delete legacy.mcpServers[first];
  NodeFS.writeFileSync(file, JSON.stringify(legacy));
  NodeAssert.equal(render(), first);
  NodeAssert.notEqual(render("different-project"), first);
  NodeAssert.notEqual(render("test-project", "different-repo"), first);
  invoke("m.removeRepo(ctx.repoDir);");
  NodeAssert.equal(NodeFS.readFileSync(file, "utf8"), original);
}));

// The Cloud CLI points FLOW_AGENT_HOME at <home>/agents, so the shim path is not
// under ~/.flow. Flow must still recognize its own hooks there, or removal strands
// them and the next setup appends a duplicate (double capture).
NodeTest.test("hooks under a custom agent home are recognized on re-setup and removal", () => fixture(({ home, repoDir, invoke }) => {
  const env = { FLOW_AGENT_HOME: NodePath.join(home, "agents") };
  const harnesses = "['claude', 'codex', 'cursor']";
  const hookFiles = [".claude/settings.json", ".codex/hooks.json", ".cursor/hooks.json"];

  invoke(`m.materializeRepo({ ...ctx, harnesses: ${harnesses} });`, env);
  const installed = NodeFS.readFileSync(NodePath.join(repoDir, hookFiles[0]), "utf8");
  NodeAssert.match(installed, /agents\/bin\/flow-hook/, "shim path should follow FLOW_AGENT_HOME");

  invoke(`m.materializeRepo({ ...ctx, harnesses: ${harnesses} });`, env);
  for (const rel of hookFiles) {
    const hooks = JSON.parse(NodeFS.readFileSync(NodePath.join(repoDir, rel), "utf8")).hooks;
    for (const [event, entries] of Object.entries(hooks)) {
      NodeAssert.equal(entries.length, 1, `${rel} ${event} duplicated on re-setup`);
    }
  }

  invoke("m.removeRepo(ctx.repoDir)", env);
  for (const rel of hookFiles) {
    NodeAssert.ok(!NodeFS.existsSync(NodePath.join(repoDir, rel)), `${rel} left behind after removal`);
  }
}));

NodeTest.test("machine-scope rendering registers every tool once in user configuration and removal restores it", () => fixture(({ home, invoke }) => {
  const codexHome = NodePath.join(home, ".codex");
  NodeFS.mkdirSync(NodePath.join(home, ".claude"), { recursive: true });
  NodeFS.mkdirSync(codexHome, { recursive: true });
  NodeFS.mkdirSync(NodePath.join(home, ".copilot"), { recursive: true });
  const userSettings = { permissions: { allow: ["Read"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "mine" }] }] } };
  NodeFS.writeFileSync(NodePath.join(home, ".claude/settings.json"), JSON.stringify(userSettings));
  NodeFS.writeFileSync(NodePath.join(home, ".claude.json"), '{"numStartups":1}');
  NodeFS.writeFileSync(NodePath.join(home, ".claude/CLAUDE.md"), "# Mine\n");
  NodeFS.writeFileSync(NodePath.join(codexHome, "config.toml"), 'model = "x"\n');
  NodeFS.writeFileSync(NodePath.join(home, ".copilot/mcp-config.json"), '{\n  // mine\n  "mcpServers": { "mine": { "command": "m" } },\n}\n');
  const all = "['claude','codex','cursor','antigravity','gemini','opencode','copilot']";
  invoke(`m.materializeGlobal({ harnesses: ${all} }); m.materializeGlobal({ harnesses: ${all} });`, { CODEX_HOME: codexHome, COPILOT_HOME: NodePath.join(home, ".copilot") });
  const claude = JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".claude/settings.json"), "utf8"));
  NodeAssert.equal(claude.hooks.Stop.length, 2);
  NodeAssert.equal(claude.hooks.SessionStart.length, 1);
  NodeAssert.doesNotMatch(claude.hooks.SessionStart[0].hooks[0].command, /--project/);
  NodeAssert.ok(claude.permissions.allow.includes("Read") && claude.permissions.allow.includes("mcp__flow-graph__orient"));
  const claudeJson = JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".claude.json"), "utf8"));
  NodeAssert.equal(claudeJson.numStartups, 1);
  NodeAssert.equal(claudeJson.mcpServers["flow-graph"].type, "stdio");
  NodeAssert.match(NodeFS.readFileSync(NodePath.join(home, ".claude/CLAUDE.md"), "utf8"), /^# Mine\n\n<!-- flow:begin/);
  const codex = NodeFS.readFileSync(NodePath.join(codexHome, "config.toml"), "utf8");
  NodeAssert.equal(codex.match(/mcp_servers\.flow-graph/g).length, 1);
  NodeAssert.match(codex, /hooks = true/);
  NodeAssert.equal(JSON.parse(NodeFS.readFileSync(NodePath.join(codexHome, "hooks.json"), "utf8")).hooks.SessionStart.length, 1);
  NodeAssert.equal(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".cursor/hooks.json"), "utf8")).hooks.sessionStart.length, 1);
  NodeAssert.equal(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".cursor/mcp.json"), "utf8")).mcpServers["flow-graph"].args.length, 1);
  NodeAssert.ok(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".gemini/config/hooks.json"), "utf8"))["flow-capture"].Stop);
  NodeAssert.ok(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".gemini/config/mcp_config.json"), "utf8")).mcpServers["flow-graph"]);
  NodeAssert.ok(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".gemini/settings.json"), "utf8")).mcpServers["flow-graph"]);
  NodeAssert.ok(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".config/opencode/opencode.json"), "utf8")).mcp["flow-graph"]);
  NodeAssert.match(NodeFS.readFileSync(NodePath.join(home, ".config/opencode/plugins/flow.ts"), "utf8"), /PROJECT = undefined/);
  const copilot = parse(NodeFS.readFileSync(NodePath.join(home, ".copilot/mcp-config.json"), "utf8"));
  NodeAssert.ok(copilot.mcpServers.mine && copilot.mcpServers["flow-graph"]);
  NodeAssert.equal(parse(NodeFS.readFileSync(NodePath.join(home, ".copilot/hooks/flow.json"), "utf8")).hooks.Stop.length, 1);
  for (const skill of [".claude/skills/flow/SKILL.md", ".agents/skills/flow/SKILL.md", ".cursor/skills/flow/SKILL.md", ".gemini/antigravity/global_skills/flow/SKILL.md", ".copilot/skills/flow/SKILL.md"])
    NodeAssert.match(NodeFS.readFileSync(NodePath.join(home, skill), "utf8"), /flow-graph/);
  invoke("m.removeGlobal()", { CODEX_HOME: codexHome, COPILOT_HOME: NodePath.join(home, ".copilot") });
  NodeAssert.deepEqual(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".claude/settings.json"), "utf8")), userSettings);
  NodeAssert.deepEqual(JSON.parse(NodeFS.readFileSync(NodePath.join(home, ".claude.json"), "utf8")), { numStartups: 1 });
  NodeAssert.equal(NodeFS.readFileSync(NodePath.join(home, ".claude/CLAUDE.md"), "utf8"), "# Mine\n");
  NodeAssert.equal(NodeFS.readFileSync(NodePath.join(codexHome, "config.toml"), "utf8"), 'model = "x"\n\n[features]\nhooks = true\n');
  NodeAssert.deepEqual(Object.keys(parse(NodeFS.readFileSync(NodePath.join(home, ".copilot/mcp-config.json"), "utf8")).mcpServers), ["mine"]);
  for (const gone of [".cursor/hooks.json", ".cursor/mcp.json", ".gemini/config/hooks.json", ".gemini/settings.json", ".config/opencode/plugins/flow.ts", ".copilot/hooks/flow.json", ".claude/skills", ".agents", codexHome + "/hooks.json"])
    NodeAssert.ok(!NodeFS.existsSync(NodePath.join(home, gone)), gone);
}));

NodeTest.test("pre-approved tools are exactly the gateway's read tools", async () => {
  const { FLOW_READ_TOOLS } = await import("../lib/materialize.mjs");
  const { SESSION_VERBS } = await import("../../graph-gateway/src/session-verbs.ts");
  const reads = [...SESSION_VERBS].filter((name) => !["remember", "correct_graph"].includes(name));
  NodeAssert.deepEqual([...FLOW_READ_TOOLS].sort(), reads.sort());
});
