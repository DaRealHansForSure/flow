import { expect, it, vi } from "vite-plus/test";

import { observeSelectionActions } from "./selectionActions";

// regression: a long-press selection on a phone never showed Cite, because its pointercancel
// read as a dismissal.
it("reports a selection made by a touch long press", async () => {
  const element = document.createElement("p");
  element.textContent = "Cite this sentence from the answer.";
  document.body.append(element);
  const onSelection = vi.fn();
  const actions = observeSelectionActions({ element, onSelection, onDismiss: vi.fn() });
  document.addEventListener("selectionchange", actions.selectionChanged);
  try {
    const touch = { pointerType: "touch", isPrimary: true, button: 0, bubbles: true } as const;
    element.dispatchEvent(new PointerEvent("pointerdown", touch));
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    window.dispatchEvent(new PointerEvent("pointercancel", touch));

    await vi.waitFor(() => expect(onSelection).toHaveBeenCalled());
  } finally {
    document.removeEventListener("selectionchange", actions.selectionChanged);
    actions.dispose();
    element.remove();
  }
});
