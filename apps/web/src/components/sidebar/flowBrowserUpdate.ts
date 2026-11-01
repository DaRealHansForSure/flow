import {
  type EnvironmentId,
  FLOW_BROWSER_UPDATE_PATH,
  FlowBrowserUpdateState,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const decodeUpdateState = Schema.decodeUnknownSync(FlowBrowserUpdateState);

export async function fetchFlowBrowserUpdate(apply = false): Promise<FlowBrowserUpdateState> {
  const response = await fetch(FLOW_BROWSER_UPDATE_PATH, {
    method: apply ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    ...(apply ? { headers: { "content-type": "application/json" }, body: "{}" } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Flow update request failed (${response.status}). Please retry.`);
  return decodeUpdateState(await response.json());
}

/** Connection loss is expected during a restart; only the target version proves success. */
export async function waitForFlowBrowserUpdate(
  version: string,
  options = {
    read: () => fetchFlowBrowserUpdate(),
    wait: () => new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    now: () => Date.now(),
  },
) {
  const deadline = options.now() + 120000;
  while (options.now() < deadline) {
    try {
      const state = await options.read();
      if (state.supported && state.currentVersion === version && !state.restarting) return;
    } catch {
      /* The server may be between stopping and accepting connections. */
    }
    await options.wait();
  }
  throw new Error(
    "Flow has not reconnected to the update yet. Retry once it is available; your saved work is retained.",
  );
}

/** A connected environment other than the server hosting this page. */
export interface FlowFleetMember {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly state: FlowBrowserUpdateState | null;
}

export interface FlowFleetUpdatePlan {
  /** Other environments with a staged release; they update one after another. */
  readonly others: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly label: string;
    readonly version: string;
  }>;
  /** The release staged on the server hosting this page; it restarts last. */
  readonly hostingVersion: string | null;
}

export function planFlowFleetUpdate(
  hosting: FlowBrowserUpdateState | null,
  members: ReadonlyArray<FlowFleetMember>,
): FlowFleetUpdatePlan {
  return {
    others: members.flatMap(({ environmentId, label, state }) =>
      state?.supported &&
      !state.restarting &&
      state.readyVersion !== null &&
      state.readyVersion !== state.currentVersion
        ? [{ environmentId, label, version: state.readyVersion }]
        : [],
    ),
    hostingVersion: hosting?.supported ? hosting.readyVersion : null,
  };
}

/** Restarting the hosting server reloads this page, so the others go first and a failure stops
 * the run before it; the page stays up to show what failed. Returns one line per failure. */
export async function runFlowFleetUpdate(
  plan: FlowFleetUpdatePlan,
  steps: {
    readonly updateOther: (member: FlowFleetUpdatePlan["others"][number]) => Promise<void>;
    readonly updateHosting: (version: string) => Promise<void>;
  },
): Promise<ReadonlyArray<string>> {
  const failures: string[] = [];
  for (const member of plan.others) {
    try {
      await steps.updateOther(member);
    } catch (cause) {
      failures.push(
        `${member.label}: ${cause instanceof Error ? cause.message : "Could not update Flow."}`,
      );
    }
  }
  if (failures.length === 0 && plan.hostingVersion !== null) {
    await steps.updateHosting(plan.hostingVersion);
  }
  return failures;
}
