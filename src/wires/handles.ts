import type { Connection } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { onSelectionChange } from '../interaction/selection';
import {
  computeConnectionAnchors,
  computeConnectionGeometry,
} from '../geometry/connectionGeometry';
import { guideCorners, seedGuidesFromPoints, stubPoint, type Point } from '../geometry/routing';
import { createSvgEl } from '../components/shared/svgHelpers';
import { redrawConnection, setGeometryChangeListener } from './connection';
import { showContextMenu } from '../interaction/contextMenu';
import { snap } from '../core/grid';
import { Modes } from '../app/modes';
import { WIRE_STUB } from '../sim/constants';

const HANDLE_SIZE = 8;

let connLayerEl: SVGSVGElement | null = null;
let viewportRef: ViewportAdapter | null = null;
let workspaceRef: HTMLElement | null = null;
let handleEls: SVGRectElement[] = [];
let dragState: { conn: Connection; guideIndex: number; handleEl: SVGRectElement } | null = null;

export function initWireHandles(
  connLayer: SVGSVGElement,
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
): void {
  connLayerEl = connLayer;
  viewportRef = viewport;
  workspaceRef = workspaceEl;

  onSelectionChange(refreshHandlesForSelection);
  setGeometryChangeListener(refreshHandlesForSelection);
  appState.onModeChange(refreshHandlesForSelection);

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function clearHandles(): void {
  for (const el of handleEls) el.remove();
  handleEls = [];
}

export function refreshHandlesForSelection(): void {
  clearHandles();
  if (dragState) return; // don't rebuild mid-drag; onDragMove keeps the dragged handle in place

  const connId = appState.selectedConnectionId;
  if (connId == null || !viewportRef || !workspaceRef || !connLayerEl) return;
  if (appState.mode !== Modes.STOP) return; // editing only makes sense while stopped

  const conn = appState.connections.find((c) => c.id === connId);
  if (!conn) return;

  const anchors = computeConnectionAnchors(viewportRef, workspaceRef, conn);
  if (!anchors) return;
  const { fromAnchor, toAnchor } = anchors;
  const stubInPoint = stubPoint(toAnchor, fromAnchor.pos, conn.stubEndLen ?? WIRE_STUB);

  // Seed editable guides from the current auto-routed shape so there's something to grab the
  // first time a still-auto-routed wire is dragged.
  if (conn.guides.length === 0) {
    const stubOutPoint = stubPoint(fromAnchor, toAnchor.pos, conn.stubStartLen ?? WIRE_STUB);
    const points = computeConnectionGeometry(viewportRef, workspaceRef, conn);
    const seeded = seedGuidesFromPoints(points, stubOutPoint, stubInPoint);
    if (seeded.length === 0) return; // straight run, nothing to bend
    conn.guides = seeded;
  }

  const corners = guideCorners(fromAnchor, toAnchor, conn.guides, conn.stubStartLen);
  const allPoints: Point[] = [...corners, stubInPoint];

  for (let i = 0; i < conn.guides.length; i++) {
    const a = allPoints[i + 1] as Point;
    const b = allPoints[i + 2] as Point;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    handleEls.push(createHandle(conn, i, mid));
  }
}

function createHandle(conn: Connection, guideIndex: number, pos: Point): SVGRectElement {
  const el = createSvgEl('rect', {
    class: 'wireHandle',
    x: pos.x - HANDLE_SIZE / 2,
    y: pos.y - HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  });
  const guide = conn.guides[guideIndex];
  el.style.cursor = guide?.type === 'H' ? 'ns-resize' : 'ew-resize';
  el.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    dragState = { conn, guideIndex, handleEl: el };
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, [
      {
        label: 'Remove this bend',
        onClick: () => {
          conn.guides.splice(guideIndex, 1);
          redrawConnection(conn);
          appState.markDirty();
        },
      },
    ]);
  });
  connLayerEl?.appendChild(el);
  return el;
}

function onDragMove(e: MouseEvent): void {
  if (!dragState || !viewportRef) return;
  const { conn, guideIndex, handleEl } = dragState;
  const guide = conn.guides[guideIndex];
  if (!guide) return;

  const world = viewportRef.clientToWorld(e.clientX, e.clientY);
  guide.pos = snap(guide.type === 'H' ? world.y : world.x);
  redrawConnection(conn);

  if (guide.type === 'H') {
    handleEl.setAttribute('y', String(guide.pos - HANDLE_SIZE / 2));
  } else {
    handleEl.setAttribute('x', String(guide.pos - HANDLE_SIZE / 2));
  }
}

function onDragEnd(): void {
  if (!dragState) return;
  dragState = null;
  appState.markDirty();
  refreshHandlesForSelection();
}
