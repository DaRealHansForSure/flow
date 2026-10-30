import { expect, it, vi } from "vite-plus/test";

import { observeSelectionActions } from "./selectionActions";

// regression: a long-press selection on a phone never showed Cite, because its contextmenu
// (Chrome on Android) and pointercancel read as a dismissal; and with the composer focused, the
// keyboard closing after the long press resized the window, which dismissed it too.
it.each([false, true])(
  "reports a selection made by a touch long press, keyboard closes=%s",
  async (keyboardCloses) => {
    const element = document.createElement("p");
    element.textContent = "Cite this sentence from the answer.";
    document.body.append(element);
    const onSelection = vi.fn();
    const actions = observeSelectionActions({ element, onSelection, onDismiss: vi.fn() });
    document.addEventListener("selectionchange", actions.selectionChanged);
    try {
      const composer = document.createElement("div");
      composer.contentEditable = "true";
      document.body.append(composer);
      composer.focus();
      const touch = { pointerType: "touch", isPrimary: true, button: 0, bubbles: true } as const;
      element.dispatchEvent(new PointerEvent("pointerdown", touch));
      const range = document.createRange();
      range.selectNodeContents(element);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      window.dispatchEvent(new PointerEvent("pointercancel", touch));
      if (keyboardCloses) {
        window.dispatchEvent(new Event("resize"));
      }

      await vi.waitFor(() => expect(onSelection).toHaveBeenCalled());
      // A focused message box would pull the selection back into itself.
      expect(document.activeElement).not.toBe(composer);
      composer.remove();
    } finally {
      document.removeEventListener("selectionchange", actions.selectionChanged);
      actions.dispose();
      element.remove();
    }
  },
);
