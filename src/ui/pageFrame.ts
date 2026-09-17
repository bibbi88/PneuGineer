import { appState } from '../app/AppState';
import { createSvgEl } from '../components/shared/svgHelpers';
import { computeContentBounds } from '../geometry/contentBounds';
import type { ProjectBarRefs } from './projectBar';

export type PageFrameSize = 'none' | 'a4' | 'a3';

/** World-space sheet sizes - this app has no other notion of a physical unit (component
 * dimensions are just arbitrary SVG px), so these are chosen to comfortably frame a typical
 * small-to-medium circuit rather than to convert real A4/A3 millimeters exactly. A3 is close to
 * (not exactly) root-2 bigger than A4 in both dimensions, same as the real sheet sizes are. */
const PAGE_FRAME_SIZES: Record<Exclude<PageFrameSize, 'none'>, { w: number; h: number; label: string }> = {
  a4: { w: 1200, h: 850, label: 'A4 · 297 × 210 mm' },
  a3: { w: 1700, h: 1200, label: 'A3 · 420 × 297 mm' },
};

const TITLE_BLOCK_W = 340;
const TITLE_BLOCK_H = 120;
const TITLE_ROW_H = 24;

let frameLayerEl: SVGElement | null = null;
let projectBarRef: ProjectBarRefs | null = null;

/** Wires up the layer this module draws into and the project-bar accessor it reads the project
 * name from (see ui/projectBar.ts - the name lives there, not on AppState, since the sidebar
 * shows it directly). Call once at startup, then `renderPageFrame()` on any later change. */
export function initPageFrame(frameLayer: SVGElement, projectBar: ProjectBarRefs): void {
  frameLayerEl = frameLayer;
  projectBarRef = projectBar;
  renderPageFrame();
}

function textEl(x: number, y: number, text: string, cls: string): SVGTextElement {
  const t = createSvgEl('text', { x, y, class: cls });
  t.textContent = text;
  return t;
}

/** Redraws the sheet outline + title block from the current AppState - call after anything that
 * could change what it shows (the size picker, any project-info field, or a project load). Draws
 * nothing at all for 'none', same as the grid does for "show grid" off. */
export function renderPageFrame(): void {
  if (!frameLayerEl) return;
  frameLayerEl.replaceChildren();

  const size = appState.pageFrameSize;
  if (size === 'none') return;
  const dims = PAGE_FRAME_SIZES[size];
  const x = appState.pageFrameX - dims.w / 2;
  const y = appState.pageFrameY - dims.h / 2;

  frameLayerEl.append(
    createSvgEl('rect', { x, y, width: dims.w, height: dims.h, class: 'pageFrameRect' }),
    textEl(x + 16, y + 28, dims.label, 'pageFrameLabel'),
  );

  // Title block: the classic bottom-right corner box, same fields as the inspector's own
  // "Project info" section (ui/inspector.ts) so this is always exactly what that panel shows.
  const bx = x + dims.w - TITLE_BLOCK_W;
  const by = y + dims.h - TITLE_BLOCK_H;
  frameLayerEl.appendChild(
    createSvgEl('rect', {
      x: bx,
      y: by,
      width: TITLE_BLOCK_W,
      height: TITLE_BLOCK_H,
      class: 'pageFrameTitleBlock',
    }),
  );

  const rows: Array<[string, string]> = [
    ['Project', projectBarRef?.getName() ?? ''],
    ['Company', appState.projectCompany],
    ['Author', appState.projectAuthor],
    ['Checked by', appState.projectCheckedBy],
  ];
  rows.forEach(([label, value], i) => {
    const rowY = by + 26 + i * TITLE_ROW_H;
    frameLayerEl?.append(
      textEl(bx + 14, rowY, `${label}:`, 'pageFrameTitleLabel'),
      textEl(bx + 108, rowY, value, 'pageFrameTitleValue'),
    );
  });
}

/** Sets the sheet size and, for an actual sheet (not 'none'), recenters it on the current
 * diagram's own content bounds - then it stays put from there, rather than continuously
 * following the diagram around like a camera would (see PageFrame's own schema doc). Switching
 * between A4 and A3 re-centers the same way, so the sheet always wraps whatever's on the canvas
 * right now rather than keeping some earlier, possibly stale, center. */
export function setPageFrameSize(size: PageFrameSize): void {
  appState.pageFrameSize = size;
  if (size !== 'none') {
    const bounds = computeContentBounds();
    const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
    const cy = bounds ? (bounds.minY + bounds.maxY) / 2 : 0;
    appState.pageFrameX = cx;
    appState.pageFrameY = cy;
  }
  renderPageFrame();
}
