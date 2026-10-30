import type { ServerProviderUsageLimits } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveUsageLimitAlert } from "./usageLimitTone";

function limits(...percents: ReadonlyArray<number>): ServerProviderUsageLimits {
  return {
    checkedAt: "2026-10-30T20:00:00.000Z",
    windows: percents.map((usedPercent, index) => ({
      id: `window-${index}`,
      kind: index === 0 ? "session" : "weekly",
      label: index === 0 ? "Session" : "Weekly",
      usedPercent,
    })),
  } as ServerProviderUsageLimits;
}

describe("resolveUsageLimitAlert", () => {
  it.each([
    [79, null],
    [80, null],
    [81, "warning"],
    [90, "warning"],
    [91, "danger"],
  ] as const)("%d %% used gives %s", (percent, tone) => {
    expect(resolveUsageLimitAlert(limits(percent))?.tone ?? null).toBe(tone);
  });

  it("follows the fullest window", () => {
    const alert = resolveUsageLimitAlert(limits(20, 95));
    expect(alert?.tone).toBe("danger");
    expect(alert?.window.label).toBe("Weekly");
  });

  it("stays plain without data or when the account could not be read", () => {
    expect(resolveUsageLimitAlert(undefined)).toBeNull();
    expect(resolveUsageLimitAlert(limits())).toBeNull();
    expect(
      resolveUsageLimitAlert({ ...limits(99), unavailable: { reason: "probeFailed" } }),
    ).toBeNull();
  });
});
