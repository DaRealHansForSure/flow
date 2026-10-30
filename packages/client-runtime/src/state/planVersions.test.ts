import {
  NodeId,
  type OrchestrationV2PlanArtifact,
  type OrchestrationV2TurnItem,
  PlanId,
  RunId,
  ThreadId,
  TurnItemId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { deriveProposedPlanVersions, planVersionLabel } from "./planVersions.ts";

const threadId = ThreadId.make("thread-plan-versions");
const runId = RunId.make("run-plan-versions");
const nodeId = NodeId.make("node-plan-versions");

function plan(
  id: string,
  status: OrchestrationV2PlanArtifact["status"],
  markdown = "",
): OrchestrationV2PlanArtifact {
  return {
    id: PlanId.make(id),
    threadId,
    runId,
    nodeId,
    kind: "proposed_plan",
    status,
    markdown,
  };
}

function planItem(
  planId: string,
  updatedAt: string,
  markdown: string,
  streaming = false,
): OrchestrationV2TurnItem {
  const at = DateTime.makeUnsafe(updatedAt);
  return {
    id: TurnItemId.make(`item-${planId}`),
    threadId,
    runId,
    nodeId,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    status: "completed",
    title: null,
    startedAt: at,
    completedAt: at,
    updatedAt: at,
    ordinal: 0,
    type: "proposed_plan",
    planId: PlanId.make(planId),
    markdown,
    streaming,
  };
}

describe("deriveProposedPlanVersions", () => {
  it("numbers stored plans in writing order, with text from the plan or its turn item", () => {
    const versions = deriveProposedPlanVersions({
      plans: [plan("plan-b", "active", "# B"), plan("plan-a", "superseded")],
      turnItems: [
        planItem("plan-b", "2026-10-30T10:05:00.000Z", "# B"),
        planItem("plan-a", "2026-10-30T10:00:00.000Z", "# A"),
      ],
    });
    expect(versions.map((version) => [version.id, version.version, version.planMarkdown])).toEqual([
      ["plan-a", 1, "# A"],
      ["plan-b", 2, "# B"],
    ]);
    expect(planVersionLabel(versions[0]!, versions.length)).toBe("Version 1 · Revised");
    expect(planVersionLabel(versions[1]!, versions.length)).toBe("Version 2");
  });

  it("skips a plan that is still streaming and sorts an open plan without its item last", () => {
    const versions = deriveProposedPlanVersions({
      plans: [
        plan("plan-open", "active", "# Open"),
        plan("plan-declined", "declined"),
        plan("plan-streaming", "draft"),
      ],
      turnItems: [
        planItem("plan-declined", "2026-10-30T10:00:00.000Z", "# Declined"),
        planItem("plan-streaming", "2026-10-30T10:10:00.000Z", "# Partial", true),
      ],
    });
    expect(versions.map((version) => version.id)).toEqual(["plan-declined", "plan-open"]);
    expect(planVersionLabel(versions[0]!, 1)).toBe("Declined");
    expect(planVersionLabel(versions[1]!, 1)).toBeNull();
  });
});
