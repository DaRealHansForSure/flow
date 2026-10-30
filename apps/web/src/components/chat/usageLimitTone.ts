import type { ServerProviderUsageLimits, ServerProviderUsageWindow } from "@t3tools/contracts";

export type UsageLimitTone = "warning" | "danger";

const WARNING_PERCENT = 80;
const DANGER_PERCENT = 90;

export interface UsageLimitAlert {
  readonly tone: UsageLimitTone;
  readonly window: ServerProviderUsageWindow;
}

/**
 * Flow: the account's fullest usage window colours the composer's provider chip, amber above 80 %
 * and red above 90 %. An account the probe could not read keeps the chip plain.
 */
export function resolveUsageLimitAlert(
  limits: ServerProviderUsageLimits | undefined,
): UsageLimitAlert | null {
  if (limits === undefined || limits.unavailable !== undefined) {
    return null;
  }
  let fullest: ServerProviderUsageWindow | null = null;
  for (const window of limits.windows) {
    if (fullest === null || window.usedPercent > fullest.usedPercent) {
      fullest = window;
    }
  }
  if (fullest === null) {
    return null;
  }
  if (fullest.usedPercent > DANGER_PERCENT) {
    return { tone: "danger", window: fullest };
  }
  if (fullest.usedPercent > WARNING_PERCENT) {
    return { tone: "warning", window: fullest };
  }
  return null;
}

/** "Weekly limit 92 % used, resets Mon 09:00" for the chip's tooltip. */
export function describeUsageLimitAlert(alert: UsageLimitAlert): string {
  const used = `${alert.window.label} limit ${Math.round(alert.window.usedPercent)} % used`;
  if (alert.window.resetsAt === undefined) {
    return used;
  }
  const resetsAt = new Date(alert.window.resetsAt).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${used}, resets ${resetsAt}`;
}

const USAGE_RECHECK_AFTER_MS = 5 * 60 * 1000;

/**
 * Flow: on returning to the app, the chip's usage is worth a fresh look once it is older than the
 * server's own 5-minute probe cache; a newer one would come back unchanged.
 */
export function usageLimitsNeedRecheck(
  limits: ServerProviderUsageLimits | undefined,
  nowMs: number,
): boolean {
  if (limits === undefined || limits.unavailable?.reason === "unsupported") {
    return false;
  }
  return nowMs - Date.parse(limits.checkedAt) >= USAGE_RECHECK_AFTER_MS;
}
