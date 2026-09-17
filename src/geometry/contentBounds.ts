import { appState } from '../app/AppState';

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The union of every component's own world-space bounds (see Component.getBounds()) - the same
 * "what's actually on the canvas" extent persistence/exportImage.ts crops its SVG/PNG export to,
 * reused here for zoom-to-fit and for centering the page frame on the current diagram. Null with
 * an empty canvas, since there's nothing to bound. */
export function computeContentBounds(): WorldBounds | null {
  if (appState.components.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of appState.components) {
    const b = c.getBounds();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { minX, minY, maxX, maxY };
}
