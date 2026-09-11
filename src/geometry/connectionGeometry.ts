import type { Connection, ComponentId } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { portGlobalPosition } from './coords';
import { routeWithGuides, type Point, type PortAnchor } from './routing';
import { autoRouteAStar } from './autoRoute';

interface CacheEntry {
  topologyVersion: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  points: Point[];
}

const cache = new Map<ComponentId, CacheEntry>();

export function computeConnectionGeometry(
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
  conn: Connection,
): Point[] {
  const fromComp = appState.findComponent(conn.from.id);
  const toComp = appState.findComponent(conn.to.id);
  if (!fromComp || !toComp) return [];

  const fromPort = fromComp.ports[conn.from.port];
  const toPort = toComp.ports[conn.to.port];
  if (!fromPort || !toPort) return [];

  const fromAnchor: PortAnchor = {
    pos: portGlobalPosition(viewport, workspaceEl, fromComp, conn.from.port),
    entryOrientation: fromPort.entryOrientation,
    pilotDir: fromPort.pilotDir,
  };
  const toAnchor: PortAnchor = {
    pos: portGlobalPosition(viewport, workspaceEl, toComp, conn.to.port),
    entryOrientation: toPort.entryOrientation,
    pilotDir: toPort.pilotDir,
  };

  if (conn.guides.length > 0) {
    return routeWithGuides(fromAnchor, toAnchor, conn.guides, conn.stubStartLen, conn.stubEndLen);
  }

  // The A* route only depends on endpoint positions and topology (which components exist/where) -
  // skip re-running it if neither has changed since the last redraw of this connection.
  const cached = cache.get(conn.id);
  if (
    cached &&
    cached.topologyVersion === appState.topologyVersion &&
    cached.fromX === fromAnchor.pos.x &&
    cached.fromY === fromAnchor.pos.y &&
    cached.toX === toAnchor.pos.x &&
    cached.toY === toAnchor.pos.y
  ) {
    return cached.points;
  }

  const excludeIds = new Set<ComponentId>([fromComp.id, toComp.id]);
  const points = autoRouteAStar(
    fromAnchor,
    toAnchor,
    appState.components,
    excludeIds,
    conn.stubStartLen,
    conn.stubEndLen,
  );

  cache.set(conn.id, {
    topologyVersion: appState.topologyVersion,
    fromX: fromAnchor.pos.x,
    fromY: fromAnchor.pos.y,
    toX: toAnchor.pos.x,
    toY: toAnchor.pos.y,
    points,
  });

  return points;
}
