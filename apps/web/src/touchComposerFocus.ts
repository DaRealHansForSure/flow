/**
 * Flow: on a touch screen the message box takes focus only when the user taps it. Closing a
 * dialog, sheet or menu hands focus back to where it was, and the chat refocuses the composer on
 * its own in several places; each of those raised the phone keyboard over what the user was doing.
 */

const COARSE_POINTER_QUERY = "(pointer: coarse)";
const COMPOSER_EDITOR_SELECTOR = '[data-testid="composer-editor"]';
const COMPOSER_AREA_SELECTOR = '[data-chat-composer-overlay="true"]';
/** A tap on the composer area focuses it right away; anything later is not that tap's doing. */
const TAP_FOCUS_WINDOW_MS = 1_000;
const ALLOWED_FOCUS_WINDOW_MS = 1_000;

let lastPointerDown: { readonly target: Element; readonly atMs: number } | null = null;
let allowedUntilMs = 0;

/** Lets the next focus of the composer through, for an action that asks for typing (Revise). */
export function allowComposerFocus(): void {
  allowedUntilMs = performance.now() + ALLOWED_FOCUS_WINDOW_MS;
}

function focusFollowsComposerTap(editor: Element, nowMs: number): boolean {
  if (lastPointerDown === null || nowMs - lastPointerDown.atMs > TAP_FOCUS_WINDOW_MS) {
    return false;
  }
  const area = editor.closest(COMPOSER_AREA_SELECTOR) ?? editor;
  return area.contains(lastPointerDown.target);
}

export function installTouchComposerFocusGuard(): void {
  const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY);
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target instanceof Element) {
        lastPointerDown = { target: event.target, atMs: performance.now() };
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "focusin",
    (event) => {
      if (!coarsePointer.matches || !(event.target instanceof HTMLElement)) {
        return;
      }
      const editor = event.target.closest(COMPOSER_EDITOR_SELECTOR);
      if (editor === null) {
        return;
      }
      const nowMs = performance.now();
      if (nowMs < allowedUntilMs || focusFollowsComposerTap(editor, nowMs)) {
        return;
      }
      event.target.blur();
    },
    { capture: true },
  );
}
