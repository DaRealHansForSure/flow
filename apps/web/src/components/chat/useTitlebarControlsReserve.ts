import { useLayoutEffect, useState, type RefObject } from "react";

import { observeResize } from "~/lib/observeResize";

const GAP_PX = 8;
const CHANGE_EVENT = "flow:titlebar-controls-change";

/**
 * Ref callback for a floating panel button group: it announces every size change, including
 * mounting and unmounting, so headers re-measure the room they leave for it.
 */
export function trackTitlebarControls(element: HTMLElement | null) {
  if (!element) {
    return;
  }
  const notify = () => window.dispatchEvent(new Event(CHANGE_EVENT));
  const stop = observeResize(element, notify);
  return () => {
    stop();
    notify();
  };
}

/**
 * Flow: how much room a header row must leave on its right for the floating panel buttons
 * (`data-workspace-titlebar-controls`) that sit over it. Measured rather than guessed, so a
 * button that appears late, such as the Brain button while a chat loads, never covers the title.
 */
export function useTitlebarControlsReserve(container: RefObject<HTMLElement | null>): number {
  const [reserve, setReserve] = useState(0);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures floating DOM controls outside React's tree and tracks their size
  useLayoutEffect(() => {
    const row = container.current;
    if (!row) {
      return;
    }
    const measure = () => {
      const rowRect = row.getBoundingClientRect();
      let next = 0;
      for (const element of document.querySelectorAll("[data-workspace-titlebar-controls]")) {
        const rect = element.getBoundingClientRect();
        const overlapsRow =
          rect.width > 0 &&
          rect.left < rowRect.right &&
          rect.right > rowRect.left &&
          rect.top < rowRect.bottom &&
          rect.bottom > rowRect.top;
        if (overlapsRow) {
          next = Math.max(next, Math.ceil(rowRect.right - rect.left) + GAP_PX);
        }
      }
      setReserve(next);
    };
    measure();
    window.addEventListener(CHANGE_EVENT, measure);
    const stopObserving = observeResize(row, measure);
    return () => {
      window.removeEventListener(CHANGE_EVENT, measure);
      stopObserving();
    };
  }, [container]);
  return reserve;
}
