import { describe, expect, it } from "@effect/vitest";

import { mapOpenCodeMcpServers } from "./mcpServers.ts";

describe("mapOpenCodeMcpServers", () => {
  it.each([
    ["connected", "connected"],
    ["pending", "pending"],
    ["disabled", "disabled"],
    ["needs_auth", "needs-auth"],
    ["needs_client_registration", "needs-auth"],
    ["failed", "failed"],
  ])("maps %s to %s", (native, status) => {
    expect(mapOpenCodeMcpServers([{ name: "docs", status: { status: native } }])[0]?.status).toBe(
      status,
    );
  });

  it("shows only the listed thread's own T3 entry on a shared server", () => {
    expect(
      mapOpenCodeMcpServers(
        [
          { name: "t3-code-thread_a", status: { status: "connected" } },
          { name: "t3-code-thread_b", status: { status: "connected" } },
          { name: "flow-graph", status: { status: "failed", error: "spawn ENOENT\nstack" } },
        ],
        "t3-code-thread_a",
      ),
    ).toEqual([
      { name: "t3-code-thread_a", status: "connected", origin: "flow" },
      { name: "flow-graph", status: "failed", origin: "flow-brain", error: "spawn ENOENT" },
    ]);
  });
});
