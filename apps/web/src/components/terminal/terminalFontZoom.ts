// Flow: pinch and Ctrl + wheel change one terminal's font size. The size is kept per terminal
// for this page's lifetime, so switching tabs or panels keeps it.

const MIN_TERMINAL_FONT_SIZE = 8;
const MAX_TERMINAL_FONT_SIZE = 32;
// A mouse wheel notch is about 100; a trackpad pinch sends many small deltas.
const WHEEL_DELTA_PER_STEP = 60;

const fontSizeOffsets = new Map<string, number>();

export function clampTerminalFontSize(size: number): number {
  return Math.min(MAX_TERMINAL_FONT_SIZE, Math.max(MIN_TERMINAL_FONT_SIZE, Math.round(size)));
}

export function readTerminalFontSizeOffset(key: string): number {
  return fontSizeOffsets.get(key) ?? 0;
}

export function writeTerminalFontSizeOffset(key: string, offset: number): void {
  if (offset === 0) {
    fontSizeOffsets.delete(key);
    return;
  }
  fontSizeOffsets.set(key, offset);
}

function touchDistance(touches: TouchList): number {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) {
    return 0;
  }
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

/**
 * Listens in the capture phase so the terminal's own wheel scrolling and the page's pinch zoom
 * never see these gestures. One-finger touches and plain wheel scrolling pass through.
 */
export function attachTerminalFontZoomGestures(
  target: HTMLElement,
  zoom: { readonly read: () => number; readonly write: (size: number) => void },
): () => void {
  let wheelDelta = 0;
  let pinch: { readonly distance: number; readonly size: number } | null = null;

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    wheelDelta += event.deltaY;
    const steps = Math.trunc(wheelDelta / WHEEL_DELTA_PER_STEP);
    if (steps === 0) {
      return;
    }
    wheelDelta -= steps * WHEEL_DELTA_PER_STEP;
    zoom.write(zoom.read() - steps);
  };
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) {
      return;
    }
    const distance = touchDistance(event.touches);
    if (distance > 0) {
      pinch = { distance, size: zoom.read() };
    }
  };
  const onTouchMove = (event: TouchEvent) => {
    if (pinch === null || event.touches.length !== 2) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    zoom.write((pinch.size * touchDistance(event.touches)) / pinch.distance);
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) {
      pinch = null;
    }
  };

  const options = { capture: true, passive: false } as const;
  target.addEventListener("wheel", onWheel, options);
  target.addEventListener("touchstart", onTouchStart, options);
  target.addEventListener("touchmove", onTouchMove, options);
  target.addEventListener("touchend", onTouchEnd, options);
  target.addEventListener("touchcancel", onTouchEnd, options);
  return () => {
    target.removeEventListener("wheel", onWheel, options);
    target.removeEventListener("touchstart", onTouchStart, options);
    target.removeEventListener("touchmove", onTouchMove, options);
    target.removeEventListener("touchend", onTouchEnd, options);
    target.removeEventListener("touchcancel", onTouchEnd, options);
  };
}
