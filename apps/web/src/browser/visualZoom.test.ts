import { describe, expect, it } from "vite-plus/test";

import { VISUAL_ZOOM_IDENTITY, zoomVisualAround } from "./visualZoom";

describe("zoomVisualAround", () => {
  const surface = { width: 400, height: 300 };

  it("keeps the pinched content under the fingers and the picture covering the surface", () => {
    const anchor = { x: 100, y: 100 };
    const zoomed = zoomVisualAround({
      from: VISUAL_ZOOM_IDENTITY,
      scale: 2,
      anchor,
      point: anchor,
      ...surface,
    });
    expect(zoomed).toEqual({ scale: 2, x: -100, y: -100 });

    const pannedPastEdge = zoomVisualAround({
      from: { scale: 2, x: -400, y: -300 },
      scale: 2,
      anchor: { x: 200, y: 150 },
      point: { x: 100, y: 50 },
      ...surface,
    });
    expect(pannedPastEdge).toEqual({ scale: 2, x: -400, y: -300 });
  });

  it("stays between fit and four times", () => {
    const point = { x: 200, y: 150 };
    const args = { from: VISUAL_ZOOM_IDENTITY, anchor: point, point, ...surface };
    expect(zoomVisualAround({ ...args, scale: 0.5 })).toBe(VISUAL_ZOOM_IDENTITY);
    expect(zoomVisualAround({ ...args, scale: 9 }).scale).toBe(4);
  });
});
