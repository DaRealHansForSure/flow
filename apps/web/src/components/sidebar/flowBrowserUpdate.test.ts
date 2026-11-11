import { describe, expect, it, vi, afterEach } from "vite-plus/test";
import type { EnvironmentId, FlowBrowserUpdateState } from "@t3tools/contracts";
import {
  fetchFlowBrowserUpdate,
  planFlowFleetUpdate,
  runFlowFleetUpdate,
  waitForFlowBrowserUpdate,
} from "./flowBrowserUpdate";

const state = {
  supported: true,
  currentVersion: "1.0.0",
  readyVersion: "1.1.0",
  restarting: false,
};
afterEach(() => vi.unstubAllGlobals());

describe("Flow browser updates", () => {
  it("uses an authenticated same-origin JSON POST for an explicit restart", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ...state, restarting: true })));
    vi.stubGlobal("fetch", fetch);
    expect((await fetchFlowBrowserUpdate(true)).restarting).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "/api/flow/browser-update",
      expect.objectContaining({ method: "POST", credentials: "same-origin", body: "{}" }),
    );
  });
  it("does not accept an HTTP error or malformed response as an update acknowledgement", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 403 })));
    await expect(fetchFlowBrowserUpdate(true)).rejects.toThrow("403");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(fetchFlowBrowserUpdate()).rejects.toThrow();
  });
  it("waits through connection loss and the old server until the target version is ready", async () => {
    let now = 0;
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(state)
      .mockResolvedValueOnce({ ...state, currentVersion: "1.1.0", readyVersion: null });
    await waitForFlowBrowserUpdate("1.1.0", {
      read,
      wait: async () => {
        now += 1000;
      },
      now: () => now,
    });
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("reports failure instead of treating a reconnect to the old version as success", async () => {
    let now = 0;
    await expect(
      waitForFlowBrowserUpdate("1.1.0", {
        read: async () => state,
        wait: async () => {
          now += 60000;
        },
        now: () => now,
      }),
    ).rejects.toThrow("not reconnected");
  });
});

describe("Flow fleet updates", () => {
  const id = (value: string) => value as EnvironmentId;
  const member = (name: string, change: Partial<FlowBrowserUpdateState> | null) => ({
    environmentId: id(name),
    label: name,
    state: change === null ? null : { ...state, ...change },
  });

  it("plans every other environment with a staged release and the hosting server last", () => {
    expect(
      planFlowFleetUpdate(state, [
        member("ext", {}),
        member("old", { supported: false }),
        member("busy", { restarting: true }),
        member("current", { readyVersion: null }),
        member("same", { currentVersion: "1.1.0" }),
        member("offline", null),
      ]),
    ).toEqual({
      others: [{ environmentId: id("ext"), label: "ext", version: "1.1.0" }],
      hostingVersion: "1.1.0",
    });
    expect(planFlowFleetUpdate({ ...state, readyVersion: null }, []).hostingVersion).toBeNull();
  });

  it("updates the other environments one after another before restarting the hosting server", async () => {
    const calls: string[] = [];
    const failures = await runFlowFleetUpdate(
      planFlowFleetUpdate(state, [member("a", {}), member("b", {})]),
      {
        updateOther: async ({ label }) => {
          calls.push(`start ${label}`);
          await Promise.resolve();
          calls.push(`done ${label}`);
        },
        updateHosting: async (version) => {
          calls.push(`hosting ${version}`);
        },
      },
    );
    expect(failures).toEqual([]);
    expect(calls).toEqual(["start a", "done a", "start b", "done b", "hosting 1.1.0"]);
  });

  it("keeps the hosting server running when another environment fails, so the page can report it", async () => {
    const updateHosting = vi.fn();
    const failures = await runFlowFleetUpdate(
      planFlowFleetUpdate(state, [member("a", {}), member("b", {})]),
      {
        updateOther: async ({ label }) => {
          if (label === "a") throw new Error("not reconnected");
        },
        updateHosting,
      },
    );
    expect(failures).toEqual(["a: not reconnected"]);
    expect(updateHosting).not.toHaveBeenCalled();
  });
});
