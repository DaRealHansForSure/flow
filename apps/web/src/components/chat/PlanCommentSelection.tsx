import { MessageSquarePlusIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { resolveSelectionActionPosition, type SelectionActionPoint } from "~/lib/selectionActions";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const SELECTION_SETTLE_MS = 250;

/**
 * Flow: a Comment button for text selected in a plan, which opens a note field. The note and
 * the passage go to onComment; the popover then closes and the selection is cleared.
 */
export function PlanCommentSelection(props: {
  readonly container: HTMLElement | null;
  readonly onComment: (passage: string, note: string) => void;
}) {
  const { container, onComment } = props;
  // Editing lives in the same state, so the popover is measured again when it grows.
  const [selection, setSelection] = useState<{
    readonly passage: string;
    readonly position: SelectionActionPoint;
    readonly editing: boolean;
  } | null>(null);
  const [note, setNote] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

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
      if (popoverRef.current?.contains(document.activeElement)) {
        return;
      }
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
        setNote("");
        return;
      }
      const rects = range.getClientRects();
      const lastRect = rects.item(rects.length - 1) ?? range.getBoundingClientRect();
      // Scrolled out of sight: hide until the selection comes back.
      if (lastRect.bottom < 0 || lastRect.top > window.innerHeight) {
        setSelection(null);
        return;
      }
      const position = resolveSelectionActionPosition({
        bounds: container.getBoundingClientRect(),
        selectionRect: lastRect,
        pointer: null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
      // Below the selection handles a touchscreen draws under the selected text.
      const handleOffset = window.matchMedia("(pointer: coarse)").matches ? 28 : 0;
      setSelection({
        editing: false,
        passage,
        position: { ...position, y: position.y + handleOffset },
      });
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

  if (!selection) {
    return null;
  }
  const close = () => {
    setSelection(null);
    setNote("");
  };
  const submit = () => {
    if (note.trim().length === 0) {
      return;
    }
    onComment(selection.passage, note);
    window.getSelection()?.removeAllRanges();
    close();
  };
  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 max-w-[calc(100vw-1rem)] rounded-lg shadow-lg"
      style={{ left: selection.position.x, top: selection.position.y }}
      data-plan-comment-popover
    >
      {selection.editing ? (
        <div className="grid w-72 gap-2 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <Textarea
            size="sm"
            autoFocus
            aria-label="Comment on the selected passage"
            placeholder="What should change here?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="xs" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button size="xs" disabled={note.trim().length === 0} onClick={submit}>
              Add comment
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="default"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setSelection({ ...selection, editing: true })}
        >
          <MessageSquarePlusIcon aria-hidden="true" className="size-3.5" />
          Comment
        </Button>
      )}
    </div>,
    document.body,
  );
}
