import type { BrainUiKnowledge } from "@flow/brain-ui";
import { Maximize2Icon, ScanIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from "../ui/dialog";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { BrainGraph } from "./BrainGraph";

const noHighlightedNodeIds: readonly string[] = [];

function BrainGraphIconButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost-muted"
            size="icon-xs"
            aria-label={props.label}
            onClick={props.onClick}
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      <TooltipPopup>{props.label}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * The graph's corner: Fit centres and fits the graph again, and Open larger, when given, opens
 * the large dialog. Pass it as the graph's `corner` function so it receives `fit`.
 */
export function brainGraphCorner(onEnlarge?: () => void) {
  // Flow: grouped on a solid background like the terminal's actions, so they read over the graph.
  return (fit: () => void) => (
    <div
      data-graph-actions=""
      className="inline-flex items-center overflow-hidden rounded-md border border-border/80 bg-background shadow-xs"
    >
      <BrainGraphIconButton label="Fit to view" onClick={fit}>
        <ScanIcon />
      </BrainGraphIconButton>
      {onEnlarge ? (
        <>
          <div className="h-4 w-px bg-border/80" />
          <BrainGraphIconButton label="Open larger" onClick={onEnlarge}>
            <Maximize2Icon />
          </BrainGraphIconButton>
        </>
      ) : null}
    </div>
  );
}

/**
 * The knowledge graph in a dialog that covers most of the viewport. The graph canvas
 * observes its own container, so it takes the dialog's size as soon as the dialog lays out.
 * `knowledge` is absent while the Brain cannot be read.
 */
export function BrainGraphDialog({
  open,
  onOpenChange,
  title,
  knowledge,
  highlightedNodeIds = noHighlightedNodeIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  knowledge: BrainUiKnowledge | undefined;
  highlightedNodeIds?: readonly string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="h-[92dvh] max-sm:h-[85dvh] sm:max-w-[96vw]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {knowledge
              ? describeKnowledge(knowledge, new Set(highlightedNodeIds).size)
              : "The brain is currently unavailable."}
          </DialogDescription>
        </DialogHeader>
        {knowledge && (
          <div className="mx-6 mb-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50">
            <BrainGraph
              knowledge={knowledge}
              highlightedNodeIds={highlightedNodeIds}
              fill
              corner={brainGraphCorner()}
            />
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}

function describeKnowledge(knowledge: BrainUiKnowledge, highlightedCount: number): string {
  const parts = [
    countLabel(knowledge.entities.length, "entity", "entities"),
    countLabel(knowledge.edges.length, "relationship", "relationships"),
  ];
  if (highlightedCount > 0) {
    parts.push(`${highlightedCount} highlighted`);
  }
  return parts.join(" · ");
}

function countLabel(count: number, singular: string, plural: string): string {
  const noun = count === 1 ? singular : plural;
  return `${count} ${noun}`;
}
