import { describe, expect, it } from "@effect/vitest";

import { mapClaudeMcpServers } from "./claudeMcpServers.ts";

describe("mapClaudeMcpServers", () => {
  it("labels T3's registered bridge and the Brain entry, and keeps provider scopes", () => {
    expect(
      mapClaudeMcpServers([
        { name: "t3-code", status: "connected", source: "dynamic", scope: "dynamic" },
        { name: "t3-code", status: "connected", source: "user", scope: "user" },
        { name: "flow-graph", status: "connected", source: "user", scope: "user" },
        { name: "claude.ai Claude Docs", status: "connected", source: "claudeai" },
      ]).map(({ name, origin, scope }) => ({ name, origin, scope })),
    ).toEqual([
      { name: "t3-code", origin: "flow", scope: undefined },
      { name: "t3-code", origin: "provider", scope: "user" },
      { name: "flow-graph", origin: "flow-brain", scope: "user" },
      { name: "claude.ai Claude Docs", origin: "provider", scope: "claudeai" },
    ]);
  });

  it("keeps status, the error's first line and tools, and never copies config", () => {
    const [server] = mapClaudeMcpServers([
      {
        name: "github",
        status: "needs-auth",
        scope: "user",
        error: "Sign in required\n    at token https://api.example.com?key=secret",
        serverInfo: { name: "github", version: "1.2.0" },
        config: {
          type: "http",
          url: "https://api.example.com/mcp?key=secret",
          headers: { Authorization: "Bearer secret" },
        },
        tools: [
          {
            name: "list_issues",
            description: "List issues.\nLong text",
            annotations: { readOnly: true },
          },
          { name: "create_issue" },
        ],
      },
    ]);
    expect(server).toEqual({
      name: "github",
      status: "needs-auth",
      origin: "provider",
      scope: "user",
      error: "Sign in required",
      version: "1.2.0",
      tools: [
        { name: "list_issues", description: "List issues.", readOnly: true },
        { name: "create_issue" },
      ],
    });
    expect(JSON.stringify(server)).not.toContain("secret");
  });
});
