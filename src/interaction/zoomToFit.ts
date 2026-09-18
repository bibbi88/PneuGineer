import type { ViewportAdapter } from '../ui/viewport';
import { computeContentBounds } from '../geometry/contentBounds';
import { fitViewToWorldRect } from './fitViewToBounds';

/** Pans/zooms the viewport so every component's own bounds fits inside the visible workspace,
 * centered, with a flat pixel margin around it. A no-op with an empty canvas, since there's
 * nothing to fit around. */
export function zoomToFit(viewport: ViewportAdapter, workspaceEl: HTMLElement): void {
  const bounds = computeContentBounds();
  if (!bounds) return;
  fitViewToWorldRect(viewport, workspaceEl, bounds);
}
