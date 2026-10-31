import { MessageSquarePlusIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  resolveSelectionActionPosition,
  selectionFocusRect,
  touchSelectionHandleClearance,
  type SelectionActionPoint,
} from "~/lib/selectionActions";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";

const SELECTION_SETTLE_MS = 250;

/**
 * Flow: a Comment button for text selected in a plan, which opens a dialog for the note. The
 * note and the passage go to onComment.
 */
export function PlanCommentSelection(props: {
  readonly container: HTMLElement | null;
  readonly onComment: (passage: string, note: string) => void;
}) {
  const { container, onComment } = props;
  const [selection, setSelection] = useState<{
    readonly passage: string;
    readonly position: SelectionActionPoint;
  } | null>(null);
  // The note is written in a dialog, which stays clear of a phone's keyboard.
  const [draftPassage, setDraftPassage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the popover DOM node and keeps it inside the window before paint
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover || !selection) {
      return;
    }
    const rect = popover.getBoundingClientRect();
    popover.style.left = `${Math.max(8, Math.min(selection.position.x, window.innerWidth - rect.width - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(selection.position.y, window.innerHeight - rect.height - 8))}px`;
  }, [selection]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to document selection changes to track text selected in the plan
  useEffect(() => {
    if (!container) {
      return;
    }
    // Touch selection (long press, handles) ends in pointercancel and no mouseup, so the
    // popover follows selectionchange; a mouse drag only counts once the button is released.
    let mouseButtonDown = false;
    let timer: number | undefined;
    const update = () => {
      const nativeSelection = window.getSelection();
      const range =
        nativeSelection && nativeSelection.rangeCount > 0 && !nativeSelection.isCollapsed
          ? nativeSelection.getRangeAt(0)
          : null;
      const passage = nativeSelection?.toString().trim() ?? "";
      if (
        range === null ||
        passage.length === 0 ||
        !container.contains(range.commonAncestorContainer)
      ) {
        setSelection(null);
        return;
      }
      const selectionBounds = range.getBoundingClientRect();
      const focusRect = selectionFocusRect(range, nativeSelection);
      // Scrolled out of sight: hide until the selection comes back.
      if (selectionBounds.bottom < 0 || selectionBounds.top > window.innerHeight) {
        setSelection(null);
        return;
      }
      const position = resolveSelectionActionPosition({
        bounds: container.getBoundingClientRect(),
        selectionRect: focusRect,
        pointer: null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
      // Below the selection handles a touchscreen draws under the selected text.
      const handleOffset = touchSelectionHandleClearance();
      setSelection({ passage, position: { ...position, y: position.y + handleOffset } });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, SELECTION_SETTLE_MS);
    };
    // The popover is fixed to the window, so it is moved with the text on every scrolled frame.
    let frame: number | undefined;
    const onScroll = () => {
      window.cancelAnimationFrame(frame ?? 0);
      frame = window.requestAnimationFrame(update);
    };
    const onSelectionChange = () => {
      if (!mouseButtonDown) {
        schedule();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button === 0) {
        mouseButtonDown = true;
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && mouseButtonDown) {
        mouseButtonDown = false;
        schedule();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame ?? 0);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [container]);

  const closeDraft = () => {
    setDraftPassage(null);
    setNote("");
  };
  const submit = () => {
    if (draftPassage === null || note.trim().length === 0) {
      return;
    }
    onComment(draftPassage, note);
    closeDraft();
  };
  return (
    <>
      {selection !== null && draftPassage === null
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-50 rounded-lg shadow-lg"
              style={{ left: selection.position.x, top: selection.position.y }}
              data-plan-comment-popover
            >
              <Button
                size="sm"
                variant="default"
                data-selection-action=""
                onClick={() => {
                  setDraftPassage(selection.passage);
                  setSelection(null);
                  window.getSelection()?.removeAllRanges();
                }}
              >
                <MessageSquarePlusIcon aria-hidden="true" className="size-3.5" />
                Comment
              </Button>
            </div>,
            document.body,
          )
        : null}
      <Dialog
        open={draftPassage !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDraft();
          }
        }}
      >
        <DialogPopup className="max-w-xl" initialFocus={noteRef}>
          <DialogHeader>
            <DialogTitle>Comment on the plan</DialogTitle>
            <DialogDescription>Sent with the passage when you Revise.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="grid gap-3">
              <blockquote className="max-h-32 overflow-y-auto border-l-2 border-border ps-3 text-muted-foreground text-sm whitespace-pre-wrap">
                {draftPassage}
              </blockquote>
              <Textarea
                ref={noteRef}
                aria-label="Comment on the selected passage"
                placeholder="What should change here?"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDraft}>
              Cancel
            </Button>
            <Button size="sm" disabled={note.trim().length === 0} onClick={submit}>
              Add comment
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
