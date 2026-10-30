import { MessageSquarePlusIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  observeSelectionActions,
  resolveSelectionActionPosition,
  type SelectionActionPoint,
} from "~/lib/selectionActions";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

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
  const actionsRef = useRef<ReturnType<typeof observeSelectionActions> | null>(null);

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
    const clear = () => {
      setSelection(null);
      setNote("");
    };
    const update = (pointer: SelectionActionPoint | null) => {
      const nativeSelection = window.getSelection();
      if (!nativeSelection || nativeSelection.rangeCount === 0 || nativeSelection.isCollapsed) {
        clear();
        return;
      }
      const range = nativeSelection.getRangeAt(0);
      const passage = nativeSelection.toString().trim();
      if (passage.length === 0 || !container.contains(range.commonAncestorContainer)) {
        clear();
        return;
      }
      const rects = range.getClientRects();
      setSelection({
        editing: false,
        passage,
        position: resolveSelectionActionPosition({
          bounds: container.getBoundingClientRect(),
          selectionRect: rects.item(rects.length - 1) ?? range.getBoundingClientRect(),
          pointer,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
      });
    };
    const actions = observeSelectionActions({
      element: container,
      getActionElement: () => popoverRef.current,
      onSelection: update,
      onDismiss: clear,
    });
    actionsRef.current = actions;
    document.addEventListener("selectionchange", actions.selectionChanged);
    return () => {
      document.removeEventListener("selectionchange", actions.selectionChanged);
      actions.dispose();
      actionsRef.current = null;
    };
  }, [container]);

  if (!selection) {
    return null;
  }
  const close = () => {
    actionsRef.current?.cancel();
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
      className="fixed z-50 max-w-[calc(100vw-1rem)]"
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
          size="xs"
          variant="glass"
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
