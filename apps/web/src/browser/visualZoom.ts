/**
 * Flow: magnifies the streamed browser picture on this screen only. The page, its zoom and every
 * other viewer stay as they are. Offsets are layout pixels of the untransformed surface, applied
 * as `translate(x, y) scale(scale)` with the origin at the top left.
 */
export interface VisualZoom {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export const VISUAL_ZOOM_IDENTITY: VisualZoom = { scale: 1, x: 0, y: 0 };
const MAX_VISUAL_ZOOM = 4;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Keeps the scale in range and the picture covering the whole surface. */
function clampVisualZoom(zoom: VisualZoom, width: number, height: number): VisualZoom {
  const scale = clamp(zoom.scale, 1, MAX_VISUAL_ZOOM);
  if (scale === 1) {
    return VISUAL_ZOOM_IDENTITY;
  }
  return {
    scale,
    x: clamp(zoom.x, width * (1 - scale), 0),
    y: clamp(zoom.y, height * (1 - scale), 0),
  };
}

/**
 * Scales `from` to `scale`, keeping the content that was under `anchor` (surface coordinates when
 * the gesture began) under `point` (surface coordinates now).
 */
export function zoomVisualAround(input: {
  readonly from: VisualZoom;
  readonly scale: number;
  readonly anchor: { readonly x: number; readonly y: number };
  readonly point: { readonly x: number; readonly y: number };
  readonly width: number;
  readonly height: number;
}): VisualZoom {
  const { from, anchor, point } = input;
  const scale = clamp(input.scale, 1, MAX_VISUAL_ZOOM);
  const contentX = (anchor.x - from.x) / from.scale;
  const contentY = (anchor.y - from.y) / from.scale;
  return clampVisualZoom(
    { scale, x: point.x - contentX * scale, y: point.y - contentY * scale },
    input.width,
    input.height,
  );
}
