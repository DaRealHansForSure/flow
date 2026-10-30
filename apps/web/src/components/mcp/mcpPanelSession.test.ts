import { describe, expect, it } from "vite-plus/test";

import { liveProviderSessionId } from "./mcpPanelSession";

type SessionProjection = Parameters<typeof liveProviderSessionId>[0];

function projection(sessionStatus: string | null): SessionProjection {
  return {
    thread: { activeProviderThreadId: "provider-thread-1" },
    providerThreads: [{ id: "provider-thread-1", providerSessionId: "session-1" }],
    providerSessions: sessionStatus === null ? [] : [{ id: "session-1", status: sessionStatus }],
  } as unknown as SessionProjection;
}

describe("liveProviderSessionId", () => {
  it.each([
    ["ready", "session-1"],
    ["running", "session-1"],
    ["waiting", "session-1"],
    ["starting", null],
    ["stopped", null],
    ["error", null],
    [null, null],
  ] as const)("a %s session gives %s", (status, expected) => {
    expect(liveProviderSessionId(projection(status))).toBe(expected);
  });

  it("has no session without a projection", () => {
    expect(liveProviderSessionId(null)).toBeNull();
  });
});
