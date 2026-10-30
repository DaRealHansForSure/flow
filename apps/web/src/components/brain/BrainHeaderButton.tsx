// Fork-only: the chat header's way into the Brain tab. It behaves like T3's diff toggle:
// opens or focuses the tab, and a press while the tab is showing hides the panel. A blue dot
// says the chat's notes changed since the tab was last shown. An amber
// icon says the Brain has not answered yet, a red one that it failed to answer.

import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { BrainCircuitIcon } from "lucide-react";
import { useEffect } from "react";

import { selectActiveRightPanel, useRightPanelStore } from "../../rightPanelStore";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useChatBrainStatusStore } from "./chatBrainStatusStore";

export function BrainHeaderButton({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const threadKey = scopedThreadKey(threadRef);
  const status = useChatBrainStatusStore((state) => state.byThreadKey[threadKey]);
  const brainShowing = useRightPanelStore(
    (state) => selectActiveRightPanel(state.byThreadKey, threadRef) === "brain",
  );
  const unseenNotes = useChatBrainStatusStore(
    (state) => state.unseenNotesByThreadKey[threadKey] === true,
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- showing the Brain tab marks its changed notes seen in the shared status store
  useEffect(() => {
    if (brainShowing && unseenNotes) {
      useChatBrainStatusStore.getState().markNotesSeen(threadKey);
    }
  }, [brainShowing, unseenNotes, threadKey]);
  if (status === undefined) {
    return null;
  }
  const showChangeDot = unseenNotes && !brainShowing && status.failure === null;
  let label = "Show Brain";
  let iconClassName = "size-4";
  if (status.failure !== null) {
    label = `Brain unavailable: ${status.failure}`;
    iconClassName = "size-4 text-destructive";
  } else if (status.loading) {
    label = "Brain is loading";
    iconClassName = "size-4 text-warning";
  } else if (brainShowing) {
    label = "Hide Brain";
  } else if (showChangeDot) {
    label = "Show Brain (notes changed)";
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="relative flex shrink-0" />}>
        <Toggle
          pressed={brainShowing}
          onPressedChange={() => useRightPanelStore.getState().toggle(threadRef, "brain")}
          aria-label={label}
          data-brain-header-button
          variant="ghost"
          size="sm"
        >
          <BrainCircuitIcon className={iconClassName} />
        </Toggle>
        {showChangeDot ? (
          <span
            aria-hidden
            data-brain-change-dot
            className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-info"
          />
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
}
