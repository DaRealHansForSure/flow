import type { ThreadStructure } from "./shell.ts";
import type { OrchestrationV2PlanArtifact, PlanId, RunId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

/** Flow: one proposed plan of a chat, numbered in the order the agent wrote them. */
export interface PlanVersion {
  readonly id: PlanId;
  readonly runId: RunId | null;
  readonly version: number;
  readonly status: OrchestrationV2PlanArtifact["status"];
  readonly planMarkdown: string;
  readonly updatedAt: string;
}

/**
 * The chat's proposed plans, oldest first. A revision is a new plan, so the stored plans are the
 * versions. Older plans carry their text only in their turn item, the active one in the plan.
 * Counts what the loaded history holds; plans paged out of a long chat are not numbered.
 */
export function deriveProposedPlanVersions(
  projection: Pick<ThreadStructure, "plans" | "turnItems"> | null,
): PlanVersion[] {
  if (projection === null) {
    return [];
  }
  const latestItemByPlanId = new Map<
    PlanId,
    { readonly markdown: string; readonly updatedAt: string; readonly streaming: boolean }
  >();
  for (const item of projection.turnItems) {
    if (item.type === "proposed_plan") {
      latestItemByPlanId.set(item.planId, {
        markdown: item.markdown,
        updatedAt: DateTime.formatIso(item.updatedAt),
        streaming: item.streaming,
      });
    }
  }
  const versions: Omit<PlanVersion, "version">[] = [];
  for (const plan of projection.plans) {
    if (plan.kind !== "proposed_plan") {
      continue;
    }
    const item = latestItemByPlanId.get(plan.id);
    if (item?.streaming === true) {
      continue;
    }
    const planMarkdown = plan.markdown.length > 0 ? plan.markdown : (item?.markdown ?? "");
    if (planMarkdown.length === 0) {
      continue;
    }
    versions.push({
      id: plan.id,
      runId: plan.runId,
      status: plan.status,
      planMarkdown,
      updatedAt: item?.updatedAt ?? "",
    });
  }
  // A plan whose turn item was paged out is the open one of a long chat, so it sorts last.
  return [...versions]
    .sort(
      (left, right) =>
        Number(left.updatedAt === "") - Number(right.updatedAt === "") ||
        left.updatedAt.localeCompare(right.updatedAt) ||
        left.id.localeCompare(right.id),
    )
    .map((plan, index) => ({ ...plan, version: index + 1 }));
}

const PLAN_STATUS_LABELS: Record<OrchestrationV2PlanArtifact["status"], string | null> = {
  draft: null,
  active: null,
  completed: "Accepted",
  superseded: "Revised",
  declined: "Declined",
};

/** "Version 2 · Declined"; a lone plan that is still open needs no label. */
export function planVersionLabel(plan: PlanVersion, versionCount: number): string | null {
  const status = PLAN_STATUS_LABELS[plan.status];
  const version = versionCount > 1 ? `Version ${plan.version}` : null;
  return [version, status].filter((part) => part !== null).join(" · ") || null;
}
