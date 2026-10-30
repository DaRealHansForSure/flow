import { proposedPlanTitle, stripDisplayedPlanMarkdown } from "@t3tools/shared/proposedPlanText";
import { memo, useState } from "react";
import { findRevealRef } from "./markdownFindContext";
import type { EnvironmentId, PlanId, ScopedThreadRef } from "@t3tools/contracts";
import { buildCollapsedProposedPlanPreviewMarkdown } from "../../proposedPlan";
import ChatMarkdown from "../ChatMarkdown";
import { EllipsisIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { useRightPanelStore } from "../../rightPanelStore";
import { PlanCommentSelection } from "./PlanCommentSelection";
import { PlanReviewActions, usePlanReview } from "./planReview";
import { planVersionLabel } from "./planVersions";
import { usePlanFileActions } from "./usePlanFileActions";

export const ProposedPlanCard = memo(function ProposedPlanCard({
  planId,
  planMarkdown,
  environmentId,
  threadRef,
  cwd,
  workspaceRoot,
  findActive = false,
}: {
  planId: PlanId;
  planMarkdown: string;
  environmentId: EnvironmentId;
  threadRef?: ScopedThreadRef | undefined;
  cwd: string | undefined;
  workspaceRoot: string | undefined;
  findActive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileActions = usePlanFileActions({ planMarkdown, environmentId, workspaceRoot });
  const { versions, review, reopen } = usePlanReview();
  const version = versions.find((candidate) => candidate.id === planId);
  const statusLabel = version ? planVersionLabel(version, versions.length) : null;
  const reviewable = review !== null && review.planId === planId;
  const [commentArea, setCommentArea] = useState<HTMLElement | null>(null);
  const title = proposedPlanTitle(planMarkdown) ?? "Proposed plan";
  const lineCount = planMarkdown.split("\n").length;
  const canCollapse = planMarkdown.length > 900 || lineCount > 20;
  const displayedPlanMarkdown = stripDisplayedPlanMarkdown(planMarkdown);
  const collapsedPreview = canCollapse
    ? buildCollapsedProposedPlanPreviewMarkdown(planMarkdown, { maxLines: 10 })
    : null;
  const isCollapsed = canCollapse && !expanded;
  // Mount clipped plans during find to count hidden matches without revealing them.
  const showPreview = isCollapsed && !findActive;
  const revealRef = findRevealRef(() => setExpanded(true));
  return (
    <div className="rounded-2xl border border-border/80 bg-card/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary">Plan</Badge>
          {}
          <h3 data-thread-find-text="true" className="truncate text-sm font-medium text-foreground">
            {title}
          </h3>
          {statusLabel ? (
            <span className="shrink-0 text-muted-foreground text-xs">{statusLabel}</span>
          ) : null}
        </div>
        <Menu>
          <MenuTrigger
            render={<Button aria-label="Plan actions" size="icon-xs" variant="outline" />}
          >
            <EllipsisIcon aria-hidden="true" className="size-4" />
          </MenuTrigger>
          <MenuPopup align="end">
            {reopen !== null && version !== undefined && version.status !== "active" ? (
              <MenuItem onClick={() => reopen(planId)}>Reopen this plan</MenuItem>
            ) : null}
            {threadRef ? (
              <MenuItem onClick={() => useRightPanelStore.getState().open(threadRef, "plan")}>
                Open in Plan tab
              </MenuItem>
            ) : null}
            <MenuItem onClick={fileActions.copy}>
              {fileActions.isCopied ? "Copied!" : "Copy to clipboard"}
            </MenuItem>
            <MenuItem onClick={fileActions.download}>Download as markdown</MenuItem>
            <MenuItem onClick={fileActions.openSaveDialog} disabled={!fileActions.canSave}>
              Save to workspace
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      <div className="mt-4" ref={setCommentArea}>
        <div
          ref={revealRef}
          className={cn("relative", isCollapsed && "max-h-104 overflow-hidden")}
          data-thread-find-text="true"
          data-thread-find-fold={isCollapsed ? "" : undefined}
        >
          {showPreview ? (
            <ChatMarkdown
              text={collapsedPreview ?? ""}
              cwd={cwd}
              environmentId={environmentId}
              threadRef={threadRef}
              isStreaming={false}
              headingLevelOffset={3}
            />
          ) : (
            <ChatMarkdown
              text={displayedPlanMarkdown}
              cwd={cwd}
              environmentId={environmentId}
              threadRef={threadRef}
              isStreaming={false}
              headingLevelOffset={3}
            />
          )}
          {isCollapsed ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-card/95 via-card/80 to-transparent" />
          ) : null}
        </div>
        {canCollapse ? (
          <div className="mt-4 flex justify-center">
            <Button
              size="sm"
              variant="outline"
              data-scroll-anchor-ignore
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Collapse plan" : "Expand plan"}
            </Button>
          </div>
        ) : null}
      </div>

      {reviewable ? (
        <div className="mt-4 flex justify-end">
          <PlanReviewActions review={review} />
        </div>
      ) : null}
      {reviewable ? (
        <PlanCommentSelection container={commentArea} onComment={review.comment} />
      ) : null}
      {fileActions.saveDialog}
    </div>
  );
});
