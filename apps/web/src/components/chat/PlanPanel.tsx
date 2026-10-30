import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { proposedPlanTitle, stripDisplayedPlanMarkdown } from "@t3tools/shared/proposedPlanText";
import { Check, Code2, Copy, Eye } from "lucide";
import { ChevronRightIcon, DownloadIcon, SaveIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { MorphIcon } from "~/components/MorphIcon";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { LatestProposedPlanState } from "../../session-logic";
import {
  FILE_SURFACE_SUBHEADER_CLASS,
  FileSurfaceAction,
  FileSurfaceLoading,
} from "../files/fileSurfaceChrome";
import { usePlanFileActions } from "./usePlanFileActions";

const ReadOnlySourcePreview = lazy(() => import("../files/ReadOnlySourcePreview"));

/** Flow: the Plan tab. Shows the chat's latest proposed plan like an opened Markdown file. */
export function PlanPanel(props: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef;
  readonly plan: LatestProposedPlanState | null;
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
  return <PlanDocument {...props} plan={props.plan} />;
}

function PlanDocument(props: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef;
  readonly plan: LatestProposedPlanState;
  readonly cwd: string | undefined;
  readonly workspaceRoot: string | undefined;
}) {
  const { planMarkdown } = props.plan;
  const [rendered, setRendered] = useState(true);
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
      {rendered ? (
        <ScrollArea className="min-h-0 flex-1">
          <ChatMarkdown
            text={stripDisplayedPlanMarkdown(planMarkdown)}
            cwd={props.cwd}
            environmentId={props.environmentId}
            threadRef={props.threadRef}
            isStreaming={false}
            className="mx-auto max-w-4xl px-6 py-5"
          />
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
