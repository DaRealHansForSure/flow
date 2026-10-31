export type SelectionActionPoint = { x: number; y: number };

export const SELECTION_MULTI_CLICK_INTERVAL_MS = 500;
const SELECTION_SCROLL_SETTLE_MS = 150;

/**
 * Room below a selection for the phone's selection handle: on a touch screen the action button
 * sits under the handle instead of beneath it, where it was hard to hit.
 */
export function touchSelectionHandleClearance(): number {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 40 : 0;
}

export function resolveSelectionActionPosition(options: {
  bounds: { left: number; top: number; width: number; height: number };
  selectionRect: { right: number; bottom: number } | null;
  pointer: SelectionActionPoint | null;
  viewport: { width: number; height: number };
}): SelectionActionPoint {
  const { bounds, selectionRect, pointer, viewport } = options;
  const preferred = pointer ?? {
    x: selectionRect?.right ?? bounds.left + bounds.width - 140,
    y: selectionRect ? selectionRect.bottom + 4 : bounds.top + 12,
  };
  return {
    x: Math.max(
      8,
      Math.min(Math.max(bounds.left, preferred.x), bounds.left + bounds.width, viewport.width - 8),
    ),
    y: Math.max(
      8,
      Math.min(Math.max(bounds.top, preferred.y), bounds.top + bounds.height, viewport.height - 8),
    ),
  };
}

type SelectionRect = { left: number; top: number; right: number; bottom: number };

/**
 * Flow: the line where a drag ended, so a selection made upwards gets its action at the top, not
 * on the line the drag started from. `selectionRect` for resolveSelectionActionPosition.
 */
export function selectionFocusRect(
  range: Range,
  selection: Selection | null,
): { right: number; bottom: number } | null {
  const rects = range.getClientRects();
  const first = rects.item(0);
  const last = rects.item(rects.length - 1);
  const backward =
    selection !== null &&
    selection.anchorNode !== null &&
    selection.focusNode !== null &&
    (selection.anchorNode === selection.focusNode
      ? selection.focusOffset < selection.anchorOffset
      : (selection.anchorNode.compareDocumentPosition(selection.focusNode) &
          Node.DOCUMENT_POSITION_PRECEDING) !==
        0);
  if (backward && first !== null) {
    return { right: first.left, bottom: first.bottom };
  }
  return last ?? range.getBoundingClientRect();
}

export function isSelectionRectVisible(rect: SelectionRect, clips: readonly SelectionRect[]) {
  let { left, top, right, bottom } = rect;
  for (const clip of clips) {
    left = Math.max(left, clip.left);
    top = Math.max(top, clip.top);
    right = Math.min(right, clip.right);
    bottom = Math.min(bottom, clip.bottom);
  }
  return right > left && bottom > top;
}

/**
 * Interactive popovers pass getActionElement to keep editing their fields from replacing the
 * captured source selection.
 */
export function observeSelectionActions({
  element,
  getActionElement,
  restoreAfterScroll = false,
  onSelection,
  onDismiss,
}: {
  element: HTMLElement;
  getActionElement?: () => HTMLElement | null;
  restoreAfterScroll?: boolean;
  onSelection: (pointer: SelectionActionPoint | null) => void;
  onDismiss: (reason: "interaction" | "cancel") => void;
}) {
  const document = element.ownerDocument;
  const view = document.defaultView!;
  let pointerDown = false;
  let gestureActive = false;
  let dismissed = false;
  let restorable = false;
  let pointer: SelectionActionPoint | null = null;
  let touchGesture = false;
  let timer: number | null = null;
  let frame: number | null = null;

  const isActionTarget = (target: EventTarget | null) =>
    target !== null && (getActionElement?.()?.contains(target as Node) ?? false);

  const cancelPending = () => {
    if (timer !== null) view.clearTimeout(timer);
    if (frame !== null) view.cancelAnimationFrame(frame);
    timer = frame = null;
  };
  const cancel = () => {
    cancelPending();
    pointerDown = gestureActive = false;
    pointer = null;
    dismissed = true;
    restorable = false;
  };
  const dismiss = () => {
    cancel();
    onDismiss("cancel");
  };
  // Flow: a long press selects text without moving focus. A focused editor elsewhere (the message
  // box) then pulls the selection back into itself, so its focus is released first.
  const releaseOutsideEditorFocus = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || element.contains(active)) return;
    const editable =
      active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA";
    if (editable) active.blur();
  };
  const onContextMenu = () => {
    // Chrome on Android fires contextmenu for the long press that selects text.
    if (touchGesture && gestureActive) {
      releaseOutsideEditorFocus();
      return;
    }
    cancel();
    onDismiss("interaction");
  };
  const schedule = (delay: number) => {
    restorable = true;
    cancelPending();
    timer = view.setTimeout(() => {
      timer = null;
      frame = view.requestAnimationFrame(() => {
        frame = null;
        onSelection(pointer);
      });
    }, delay);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    if (isActionTarget(event.target)) {
      cancel();
      return;
    }
    cancelPending();
    pointerDown = event.button === 0;
    const inside = element.contains(event.target as Node);
    gestureActive = false;
    dismissed = true;
    restorable = false;
    pointer = null;
    if (inside) onDismiss("interaction");
    else if (getActionElement?.()) onDismiss("cancel");
  };
  const onSelectionStart = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    const target = event.target as Element | null;
    if (target?.closest("button, [role=button]")) return;
    gestureActive = event.button === 0 && !event.defaultPrevented;
    touchGesture = event.pointerType !== "mouse";
    dismissed = !gestureActive;
  };
  const onPointerUp = (event: PointerEvent) => {
    // Preventing pointerdown (for example on a toolbar) can suppress mouseup.
    if (event.isPrimary && event.button === 0) pointerDown = false;
  };
  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) return;
    pointerDown = false;
    if (!gestureActive) return;
    gestureActive = false;
    pointer = { x: event.clientX, y: event.clientY };
    schedule(event.detail >= 2 ? SELECTION_MULTI_CLICK_INTERVAL_MS : 0);
  };
  // A touch long press that selects text ends in pointercancel instead of mouseup; it
  // finishes the gesture rather than dismissing it, so handle drags afterwards still count.
  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && gestureActive) {
      releaseOutsideEditorFocus();
      pointerDown = gestureActive = false;
      pointer = null;
      dismissed = false;
      schedule(0);
      return;
    }
    dismiss();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (isActionTarget(event.target) && event.key !== "Escape") return;
    if (event.key === "Escape") {
      dismiss();
    } else if (!pointerDown) {
      cancelPending();
      gestureActive = false;
      pointer = null;
      dismissed = false;
    }
  };
  const onFocusIn = (event: FocusEvent) => {
    if (isActionTarget(event.target)) cancel();
    else if (!pointerDown && getActionElement?.()) dismiss();
  };
  const onScroll = () => {
    cancelPending();
    // Autoscroll during a drag must not cancel that gesture's eventual release.
    if (!pointerDown) {
      pointer = null;
      if (restoreAfterScroll && !dismissed && restorable) schedule(SELECTION_SCROLL_SETTLE_MS);
      else dismissed = true;
    }
    onDismiss("cancel");
  };

  // Flow: a phone keyboard opening or closing changes only the height. A long press in the chat
  // while the composer has focus closes the keyboard right after selecting, so that resize
  // settles and places the actions again instead of dismissing them; a real resize still does.
  let viewWidth = view.innerWidth;
  const onResize = () => {
    const widthChanged = view.innerWidth !== viewWidth;
    viewWidth = view.innerWidth;
    if (widthChanged) {
      dismiss();
      return;
    }
    cancelPending();
    if (!pointerDown && !dismissed && restorable) {
      schedule(SELECTION_SCROLL_SETTLE_MS);
    }
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  element.addEventListener("pointerdown", onSelectionStart);
  view.addEventListener("pointerup", onPointerUp);
  view.addEventListener("mouseup", onMouseUp);
  view.addEventListener("pointercancel", onPointerCancel);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("focusin", onFocusIn);
  element.addEventListener("contextmenu", onContextMenu, true);
  element.addEventListener("scroll", onScroll, true);
  view.addEventListener("blur", dismiss);
  view.addEventListener("resize", onResize);

  return {
    get pending() {
      return timer !== null || frame !== null;
    },
    cancel,
    selectionChanged() {
      if (isActionTarget(document.activeElement)) return;
      if (pointerDown || gestureActive) {
        onDismiss("cancel");
      } else if (!dismissed && timer === null && frame === null) {
        schedule(0);
      }
    },
    dispose() {
      cancel();
      document.removeEventListener("pointerdown", onPointerDown, true);
      element.removeEventListener("pointerdown", onSelectionStart);
      view.removeEventListener("pointerup", onPointerUp);
      view.removeEventListener("mouseup", onMouseUp);
      view.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("contextmenu", onContextMenu, true);
      element.removeEventListener("scroll", onScroll, true);
      view.removeEventListener("blur", dismiss);
      view.removeEventListener("resize", onResize);
    },
  };
}
