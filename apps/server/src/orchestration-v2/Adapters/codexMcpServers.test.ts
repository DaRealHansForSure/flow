import { describe, expect, it } from "@effect/vitest";
import type * as CodexSchema from "effect-codex-app-server/schema";

import { mapCodexMcpServers } from "./codexMcpServers.ts";

const server = (
  overrides: Partial<CodexSchema.V2ListMcpServerStatusResponse__McpServerStatus>,
): CodexSchema.V2ListMcpServerStatusResponse__McpServerStatus => ({
  name: "docs",
  authStatus: "unsupported",
  resources: [],
  resourceTemplates: [],
  tools: {},
  ...overrides,
});

const tool = { name: "search", inputSchema: {} };

describe("mapCodexMcpServers", () => {
  it.each([
    [{ runtimeStatus: "connected" }, "connected"],
    [{ runtimeStatus: "starting" }, "pending"],
    [{ runtimeStatus: "notStarted" }, "pending"],
    [{ runtimeStatus: "authenticationRequired" }, "needs-auth"],
    [{ runtimeStatus: "failed" }, "failed"],
    [{ runtimeStatus: "cancelled" }, "failed"],
    [{ runtimeStatus: "disabled" }, "disabled"],
    [{ runtimeStatus: null, authStatus: "notLoggedIn" }, "needs-auth"],
    [{ runtimeStatus: null, tools: { search: tool } }, "connected"],
    [{ runtimeStatus: null }, "pending"],
  ] as const)("maps %o to %s", (overrides, status) => {
    expect(mapCodexMcpServers([server(overrides)])[0]?.status).toBe(status);
  });

  it("marks plugins, keeps the tools error and reads readOnlyHint", () => {
    expect(
      mapCodexMcpServers([
        server({
          name: "t3-code",
          runtimeStatus: "connected",
          tools: {
            read: { name: "read", inputSchema: {}, annotations: { readOnlyHint: true } },
          },
        }),
        server({
          name: "linear",
          pluginId: "linear@1",
          runtimeStatus: "connected",
          toolsError: "tools/list timed out\ndetails",
          httpOrigin: "https://mcp.linear.app",
        }),
      ]),
    ).toEqual([
      {
        name: "t3-code",
        status: "connected",
        origin: "flow",
        tools: [{ name: "read", readOnly: true }],
      },
      {
        name: "linear",
        status: "connected",
        origin: "provider",
        scope: "plugin",
        error: "tools/list timed out",
        tools: [],
      },
    ]);
  });
});
