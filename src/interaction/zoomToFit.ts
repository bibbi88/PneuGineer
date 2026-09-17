import type { ViewportAdapter } from '../ui/viewport';
import { computeContentBounds } from '../geometry/contentBounds';

const FIT_PADDING_PX = 60;

/** Pans/zooms the viewport so every component's own bounds fits inside the visible workspace,
 * centered, with a flat pixel margin around it. A no-op with an empty canvas, since there's
 * nothing to fit around. */
export function zoomToFit(viewport: ViewportAdapter, workspaceEl: HTMLElement): void {
  const bounds = computeContentBounds();
  if (!bounds) return;
  const { minX, minY, maxX, maxY } = bounds;

  const rect = workspaceEl.getBoundingClientRect();
  const availW = Math.max(1, rect.width - FIT_PADDING_PX * 2);
  const availH = Math.max(1, rect.height - FIT_PADDING_PX * 2);
  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  // setTransform itself clamps to the viewport's own min/max zoom, so a single tiny component
  // doesn't zoom in absurdly far and a huge sprawling diagram doesn't zoom out past legibility.
  const scale = Math.min(availW / contentW, availH / contentH);

  const worldCx = (minX + maxX) / 2;
  const worldCy = (minY + maxY) / 2;
  viewport.setTransform(scale, rect.width / 2 - worldCx * scale, rect.height / 2 - worldCy * scale);
}
