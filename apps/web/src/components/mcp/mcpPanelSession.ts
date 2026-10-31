import type { OrchestrationV2ThreadProjection } from "@t3tools/contracts";

const LIVE_SESSION_STATUSES = new Set(["ready", "running", "waiting"]);

/**
 * The chat's live provider session, or null when it has none. The MCP tab asks the agent once on
 * open; when that answer was "not running", a session appearing here is the cue to ask again.
 */
export function liveProviderSessionId(
  projection: {
    readonly thread: Pick<OrchestrationV2ThreadProjection["thread"], "activeProviderThreadId">;
    readonly providerThreads: OrchestrationV2ThreadProjection["providerThreads"];
    readonly providerSessions: OrchestrationV2ThreadProjection["providerSessions"];
  } | null,
): string | null {
  if (projection === null) {
    return null;
  }
  const providerThread = projection.providerThreads.find(
    (candidate) => candidate.id === projection.thread.activeProviderThreadId,
  );
  const sessionId = providerThread?.providerSessionId ?? null;
  if (sessionId === null) {
    return null;
  }
  const session = projection.providerSessions.find((candidate) => candidate.id === sessionId);
  return session !== undefined && LIVE_SESSION_STATUSES.has(session.status)
    ? String(sessionId)
    : null;
}
