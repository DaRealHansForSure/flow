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

/** When the composer area was last tapped; read at tap time, as expanding replaces the tapped node. */
let lastComposerTapAtMs: number | null = null;
let allowedUntilMs = 0;

/** Lets the next focus of the composer through, for an action that asks for typing (Revise). */
export function allowComposerFocus(): void {
  allowedUntilMs = performance.now() + ALLOWED_FOCUS_WINDOW_MS;
}

function focusFollowsComposerTap(nowMs: number): boolean {
  return lastComposerTapAtMs !== null && nowMs - lastComposerTapAtMs <= TAP_FOCUS_WINDOW_MS;
}

export function installTouchComposerFocusGuard(): void {
  const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY);
  document.addEventListener(
    "pointerdown",
    (event) => {
      const tappedComposer =
        event.target instanceof Element &&
        event.target.closest(`${COMPOSER_AREA_SELECTOR}, ${COMPOSER_EDITOR_SELECTOR}`) !== null;
      lastComposerTapAtMs = tappedComposer ? performance.now() : null;
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
      if (nowMs < allowedUntilMs || focusFollowsComposerTap(nowMs)) {
        return;
      }
      // The app must not see this focus either: the composer would count itself focused, cancel
      // its own collapse after the blur, and stay open without a cursor.
      event.stopImmediatePropagation();
      event.target.blur();
    },
    { capture: true },
  );
}
