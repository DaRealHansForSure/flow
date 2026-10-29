// Fork-only: the chat header's way into the Brain tab. It behaves like T3's diff toggle:
// opens or focuses the tab, and a press while the tab is showing hides the panel. While
// the tab is not showing, a static dot says the Brain is writing this chat's notes; a red
// icon says the Brain failed to answer.

import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { BrainCircuitIcon } from "lucide-react";

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
  if (status === undefined) {
    return null;
  }
  const showUpdateDot = status.updating && !brainShowing && status.failure === null;
  let label = "Show Brain";
  if (status.failure !== null) {
    label = `Brain unavailable: ${status.failure}`;
  } else if (brainShowing) {
    label = "Hide Brain";
  } else if (showUpdateDot) {
    label = "Show Brain (updating notes, auto-docs, and skills)";
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
          <BrainCircuitIcon
            className={status.failure === null ? "size-4" : "size-4 text-destructive"}
          />
        </Toggle>
        {showUpdateDot ? (
          <span
            aria-hidden
            data-brain-update-dot
            className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-primary"
          />
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
}
