import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { proposedPlanTitle, stripDisplayedPlanMarkdown } from "@t3tools/shared/proposedPlanText";
import { Check, Code2, Copy, Eye } from "lucide";
import { ChevronRightIcon, DownloadIcon, SaveIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { MorphIcon } from "~/components/MorphIcon";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  FILE_SURFACE_SUBHEADER_CLASS,
  FileSurfaceAction,
  FileSurfaceLoading,
} from "../files/fileSurfaceChrome";
import { PlanCommentSelection } from "./PlanCommentSelection";
import { PlanReviewActions, usePlanReview } from "./planReview";
import { type PlanVersion, planVersionLabel } from "./planVersions";
import { usePlanFileActions } from "./usePlanFileActions";

const ReadOnlySourcePreview = lazy(() => import("../files/ReadOnlySourcePreview"));

/** Flow: the Plan tab. Shows the chat's latest proposed plan like an opened Markdown file. */
export function PlanPanel(props: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef;
  readonly plan: PlanVersion | null;
  readonly cwd: string | undefined;
  readonly workspaceRoot: string | undefined;
}) {
  if (props.plan === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-muted-foreground text-xs">
        No plan yet. Switch the chat to Plan and describe what you want to build.
      </div>
    );
  }
  return <PlanDocument key={props.plan.id} {...props} plan={props.plan} />;
}

function PlanDocument(props: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef;
  readonly plan: PlanVersion;
  readonly cwd: string | undefined;
  readonly workspaceRoot: string | undefined;
}) {
  const { versions, review, reopen } = usePlanReview();
  // Another version stays shown until a new plan arrives, which remounts this document.
  const [selectedPlanId, setSelectedPlanId] = useState(props.plan.id);
  const plan = versions.find((version) => version.id === selectedPlanId) ?? props.plan;
  const { planMarkdown } = plan;
  const statusLabel = planVersionLabel(plan, versions.length);
  const [rendered, setRendered] = useState(true);
  const reviewable = review !== null && review.planId === plan.id;
  const [commentArea, setCommentArea] = useState<HTMLElement | null>(null);
  const fileActions = usePlanFileActions({
    planMarkdown,
    environmentId: props.environmentId,
    workspaceRoot: props.workspaceRoot,
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className={FILE_SURFACE_SUBHEADER_CLASS} data-surface-subheader>
        <div className="flex min-w-0 flex-1 items-center text-xs">
          <span className="shrink-0 px-0.5 text-muted-foreground">Plan</span>
          <ChevronRightIcon className="mx-1 size-3.5 shrink-0 text-muted-foreground/60" />
          <span aria-current="page" className="min-w-0 truncate px-0.5 font-medium text-foreground">
            {proposedPlanTitle(planMarkdown) ?? "Proposed plan"}
          </span>
        </div>
        {versions.length > 1 ? (
          // The trigger fills its parent; this keeps it to its content so the title can truncate.
          <div className="shrink-0">
            <Select
              value={plan.id}
              onValueChange={(value) => {
                if (value) {
                  setSelectedPlanId(value);
                }
              }}
            >
              <SelectTrigger size="xs" aria-label="Plan version">
                <SelectValue>{statusLabel ?? `Version ${plan.version}`}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {versions.toReversed().map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {planVersionLabel(version, versions.length)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        ) : statusLabel ? (
          <span className="shrink-0 text-muted-foreground text-xs">{statusLabel}</span>
        ) : null}
        <FileSurfaceAction
          label={rendered ? "Show markdown source" : "Show rendered markdown"}
          pressed={rendered}
          onPress={() => setRendered((value) => !value)}
        >
          <MorphIcon className="size-3.5" icon={rendered ? Code2 : Eye} />
        </FileSurfaceAction>
        <FileSurfaceAction
          label={fileActions.isCopied ? "Copied" : "Copy plan"}
          onPress={fileActions.copy}
        >
          <MorphIcon className="size-3.5" icon={fileActions.isCopied ? Check : Copy} />
        </FileSurfaceAction>
        <FileSurfaceAction label="Download as markdown" onPress={fileActions.download}>
          <DownloadIcon className="size-3.5" />
        </FileSurfaceAction>
        <FileSurfaceAction
          label="Save as file in the workspace"
          disabled={!fileActions.canSave}
          onPress={fileActions.openSaveDialog}
        >
          <SaveIcon className="size-3.5" />
        </FileSurfaceAction>
      </div>
      {reviewable ? (
        <div className="flex shrink-0 justify-end border-b border-border/60 px-3 py-2">
          <PlanReviewActions review={review} />
        </div>
      ) : reopen !== null && plan.status !== "active" ? (
        <div className="flex shrink-0 justify-end border-b border-border/60 px-3 py-2">
          <Button size="sm" variant="outline" onClick={() => reopen(plan.id)}>
            Reopen this plan
          </Button>
        </div>
      ) : null}
      {reviewable && rendered ? (
        <PlanCommentSelection container={commentArea} onComment={review.comment} />
      ) : null}
      {rendered ? (
        <ScrollArea className="min-h-0 flex-1">
          <div ref={setCommentArea}>
            <ChatMarkdown
              text={stripDisplayedPlanMarkdown(planMarkdown)}
              cwd={props.cwd}
              environmentId={props.environmentId}
              threadRef={props.threadRef}
              isStreaming={false}
              className="mx-auto max-w-4xl px-6 py-5"
            />
          </div>
        </ScrollArea>
      ) : (
        <Suspense fallback={<FileSurfaceLoading />}>
          <ReadOnlySourcePreview name={fileActions.downloadFilename} text={planMarkdown} />
        </Suspense>
      )}
      {fileActions.saveDialog}
    </div>
  );
}
