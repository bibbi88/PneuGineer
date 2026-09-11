import type { Connection, ConnectionEndpoint, WireGuide } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { uid } from '../core/ids';
import { createSvgEl } from '../components/shared/svgHelpers';
import { computeConnectionGeometry } from '../geometry/connectionGeometry';
import {
  distPointToSegment,
  pathFromPoints,
  polylineMidpoint,
  type Point,
} from '../geometry/routing';
import { selectConnection } from '../interaction/selection';
import { showContextMenu } from '../interaction/contextMenu';

let connLayerEl: SVGSVGElement | null = null;
let viewportRef: ViewportAdapter | null = null;
let workspaceRef: HTMLElement | null = null;

/**
 * Set by interaction/wireSplitting.ts (dependency-injected to avoid a connection<->linking
 * import cycle): returning true means the click was consumed (e.g. split into a junction).
 */
let wireClickInterceptor: ((conn: Connection, clientX: number, clientY: number) => boolean) | null =
  null;

export function setWireClickInterceptor(
  fn: (conn: Connection, clientX: number, clientY: number) => boolean,
): void {
  wireClickInterceptor = fn;
}

export function initWires(
  connLayer: SVGSVGElement,
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
): void {
  connLayerEl = connLayer;
  viewportRef = viewport;
  workspaceRef = workspaceEl;
}

export function createConnection(from: ConnectionEndpoint, to: ConnectionEndpoint): Connection {
  if (!connLayerEl) throw new Error('initWires() must be called before creating connections');

  const pathEl = createSvgEl('path', { class: 'wire', fill: 'none' });
  const hitEl = createSvgEl('path', { class: 'wireHit', fill: 'none' });
  const labelEl = createSvgEl('text', { class: 'wireLabel', 'font-size': 10 });
  connLayerEl.append(pathEl, hitEl, labelEl);

  const conn: Connection = {
    id: uid(),
    from,
    to,
    guides: [],
    stubStartLen: null,
    stubEndLen: null,
    pathEl,
    hitEl,
    labelEl,
  };

  hitEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wireClickInterceptor?.(conn, e.clientX, e.clientY)) return;
    selectConnection(conn.id);
  });
  hitEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    insertBendAtClick(conn, e.clientX, e.clientY);
  });
  hitEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectConnection(conn.id);
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Clear bends (reset to auto-route)', onClick: () => resetToAutoRoute(conn.id) },
      { label: 'Delete wire', onClick: () => removeConnection(conn.id) },
    ]);
  });

  appState.addConnection(conn);
  redrawConnection(conn);
  return conn;
}

export function removeConnection(connId: number): void {
  const conn = appState.connections.find((c) => c.id === connId);
  if (!conn) return;
  conn.pathEl.remove();
  conn.hitEl.remove();
  conn.labelEl.remove();
  appState.removeConnection(connId);
}

export function resetToAutoRoute(connId: number): void {
  const conn = appState.connections.find((c) => c.id === connId);
  if (!conn) return;
  conn.guides = [];
  conn.stubStartLen = null;
  conn.stubEndLen = null;
  redrawConnection(conn);
}

/**
 * Reroutes the wire's middle segment to pass through the clicked point, dragging it
 * perpendicular to its own direction (a horizontal run moves up/down, a vertical run
 * moves left/right) while staying fully orthogonal on both sides.
 *
 * Only handles the single default auto-routed corner (the common case: no guides yet).
 * A wire that already has custom guides from a previous edit is left alone here -
 * further bends on an already-customized wire should go through drag handles instead.
 */
function insertBendAtClick(conn: Connection, clientX: number, clientY: number): void {
  if (!viewportRef || !workspaceRef || conn.guides.length > 0) return;

  const clickWorld = viewportRef.clientToWorld(clientX, clientY);
  const points = computeConnectionGeometry(viewportRef, workspaceRef, conn);
  if (points.length < 4) return;

  const stubOut = points[1] as Point;
  const stubIn = points[points.length - 2] as Point;
  if (distPointToSegment(clickWorld, stubOut, stubIn) > 60) return;

  const horizontal = stubOut.y === stubIn.y;
  const guides: WireGuide[] = horizontal
    ? [
        { type: 'H', pos: clickWorld.y },
        { type: 'V', pos: stubIn.x },
      ]
    : [
        { type: 'V', pos: clickWorld.x },
        { type: 'H', pos: stubIn.y },
      ];

  conn.guides = guides;
  redrawConnection(conn);
}

export function redrawConnection(conn: Connection): void {
  if (!viewportRef || !workspaceRef) return;
  const points = computeConnectionGeometry(viewportRef, workspaceRef, conn);
  const d = pathFromPoints(points);
  conn.pathEl.setAttribute('d', d);
  conn.hitEl.setAttribute('d', d);

  const mid = polylineMidpoint(points);
  conn.labelEl.setAttribute('x', String(mid.x));
  conn.labelEl.setAttribute('y', String(mid.y - 4));
}

export function redrawAllConnections(): void {
  for (const c of appState.connections) redrawConnection(c);
}
