// Fork-only slowness diagnostics: renderer stalls, route timings, slow or large API
// responses. Lines start with LOG_PREFIX so they can be grepped from the Dev Flow log.
// On in development builds; elsewhere `localStorage.setItem("flow:perf-log", "1")`
// and a reload turn it on.

import type { AnyRouter } from "@tanstack/react-router";

const LOG_PREFIX = "[flow-perf]";
const ENABLE_STORAGE_KEY = "flow:perf-log";
// A frame this long is a visible stutter; shorter ones would drown the log.
const SLOW_FRAME_MS = 100;
const SLOW_RESPONSE_MS = 200;
const LARGE_RESPONSE_BYTES = 1024 * 1024;
const SCRIPTS_PER_FRAME = 3;

/** Script attribution of a long animation frame (Chromium 123+, so Electron). */
interface LongAnimationFrameScript {
  readonly duration: number;
  readonly invoker: string;
  readonly sourceURL: string;
  readonly sourceFunctionName: string;
}

interface LongAnimationFrameEntry extends PerformanceEntry {
  readonly blockingDuration: number;
  readonly scripts: readonly LongAnimationFrameScript[];
}

function isPerformanceLogEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }
  try {
    return window.localStorage.getItem(ENABLE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function formatMs(durationMs: number): string {
  return `${Math.round(durationMs)}ms`;
}

function formatBytes(bytes: number): string {
  if (bytes >= LARGE_RESPONSE_BYTES) {
    return `${(bytes / LARGE_RESPONSE_BYTES).toFixed(1)}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}

/** Short "function file:line" label; the full Vite URL is mostly noise. */
function describeScript(script: LongAnimationFrameScript): string {
  const file = script.sourceURL.split("/").pop()?.split("?")[0] ?? "";
  const name = script.sourceFunctionName || script.invoker || "anonymous";
  return `${name} (${file}) ${formatMs(script.duration)}`;
}

function observeLongAnimationFrames(): void {
  const supported = PerformanceObserver.supportedEntryTypes.includes("long-animation-frame");
  if (!supported) {
    return;
  }
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as LongAnimationFrameEntry[]) {
      if (entry.duration < SLOW_FRAME_MS) {
        continue;
      }
      const slowestScripts = [...entry.scripts]
        .sort((first, second) => second.duration - first.duration)
        .slice(0, SCRIPTS_PER_FRAME)
        .map(describeScript);
      console.warn(
        `${LOG_PREFIX} renderer blocked ${formatMs(entry.duration)}` +
          ` (blocking ${formatMs(entry.blockingDuration)}): ${slowestScripts.join(" | ")}`,
      );
    }
  });
  observer.observe({ type: "long-animation-frame", buffered: true });
}

function observeApiResponses(): void {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      if (!entry.name.includes("/api/")) {
        continue;
      }
      const isSlow = entry.duration >= SLOW_RESPONSE_MS;
      const isLarge = entry.decodedBodySize >= LARGE_RESPONSE_BYTES;
      if (!isSlow && !isLarge) {
        continue;
      }
      const path = new URL(entry.name).pathname;
      console.warn(
        `${LOG_PREFIX} api ${path} ${formatMs(entry.duration)}` +
          ` (waiting ${formatMs(entry.responseStart - entry.requestStart)},` +
          ` body ${formatBytes(entry.decodedBodySize)})`,
      );
    }
  });
  observer.observe({ type: "resource", buffered: true });
}

/** Logs each route change: when its data resolved and when it was on screen. */
function observeNavigation(router: AnyRouter): void {
  const startedAt = new Map<string, number>();
  router.subscribe("onBeforeNavigate", (event) => {
    startedAt.set(event.toLocation.href, performance.now());
  });
  router.subscribe("onResolved", (event) => {
    const start = startedAt.get(event.toLocation.href);
    if (start !== undefined) {
      console.info(
        `${LOG_PREFIX} route ${event.toLocation.pathname} data ready after ${formatMs(performance.now() - start)}`,
      );
    }
  });
  router.subscribe("onRendered", (event) => {
    const start = startedAt.get(event.toLocation.href);
    if (start === undefined) {
      return;
    }
    startedAt.delete(event.toLocation.href);
    console.info(
      `${LOG_PREFIX} route ${event.toLocation.pathname} on screen after ${formatMs(performance.now() - start)}`,
    );
  });
}

/** Installs the observers once at startup; does nothing unless enabled. */
export function installDevPerformanceLog(router: AnyRouter): void {
  if (!isPerformanceLogEnabled()) {
    return;
  }
  observeLongAnimationFrames();
  observeApiResponses();
  observeNavigation(router);
  console.info(`${LOG_PREFIX} performance log on (threshold ${SLOW_FRAME_MS}ms)`);
}
