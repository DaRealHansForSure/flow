import type { BrainUiKnowledge } from "@flow/brain-ui";
import { Maximize2Icon } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from "../ui/dialog";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { BrainGraph } from "./BrainGraph";

const noHighlightedNodeIds: readonly string[] = [];

/** Icon button that opens the knowledge graph in the large dialog. */
export function BrainGraphExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost-muted" size="icon-xs" aria-label="Open larger" onClick={onClick} />
        }
      >
        <Maximize2Icon />
      </TooltipTrigger>
      <TooltipPopup>Open larger</TooltipPopup>
    </Tooltip>
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
            <BrainGraph knowledge={knowledge} highlightedNodeIds={highlightedNodeIds} fill />
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
