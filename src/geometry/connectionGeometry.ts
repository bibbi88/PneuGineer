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

export function computeConnectionAnchors(
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
  conn: Connection,
): { fromAnchor: PortAnchor; toAnchor: PortAnchor } | null {
  const fromComp = appState.findComponent(conn.from.id);
  const toComp = appState.findComponent(conn.to.id);
  if (!fromComp || !toComp) return null;

  const fromPort = fromComp.ports[conn.from.port];
  const toPort = toComp.ports[conn.to.port];
  if (!fromPort || !toPort) return null;

  return {
    fromAnchor: {
      pos: portGlobalPosition(viewport, workspaceEl, fromComp, conn.from.port),
      entryOrientation: fromPort.entryOrientation,
      pilotDir: fromPort.pilotDir,
    },
    toAnchor: {
      pos: portGlobalPosition(viewport, workspaceEl, toComp, conn.to.port),
      entryOrientation: toPort.entryOrientation,
      pilotDir: toPort.pilotDir,
    },
  };
}

export function computeConnectionGeometry(
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
  conn: Connection,
): Point[] {
  const anchors = computeConnectionAnchors(viewport, workspaceEl, conn);
  if (!anchors) return [];
  const { fromAnchor, toAnchor } = anchors;

  // A connection has "explicit" geometry - and should be drawn exactly via its guides/stub
  // lengths rather than re-auto-routed - once anything has deliberately set one of those
  // fields, even to a value (like an empty guide list, or a zero stub) that matches what A*
  // might have produced anyway. guides.length > 0 alone isn't enough: wire-splitting can
  // deliberately produce a connection with zero guides (a straight run with no bends) that
  // still must not fall through to A*, which only guarantees a *shortest* path, not the exact
  // straight line the split was preserving - so a non-null stub length (only ever set by
  // deliberate editing, never left as A*'s implicit default) is treated as the same signal.
  if (conn.guides.length > 0 || conn.stubStartLen !== null || conn.stubEndLen !== null) {
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

  const excludeIds = new Set<ComponentId>([conn.from.id, conn.to.id]);
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
