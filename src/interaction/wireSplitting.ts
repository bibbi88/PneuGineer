import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { createJunction } from '../components/junction';
import {
  createConnection,
  redrawConnection,
  removeConnection,
  setWireClickInterceptor,
} from '../wires/connection';
import { computeConnectionAnchors, computeConnectionGeometry } from '../geometry/connectionGeometry';
import {
  distPointToSegment,
  guideCorners,
  seedGuidesFromPoints,
  stubPoint,
  type Point,
} from '../geometry/routing';
import { WIRE_STUB } from '../sim/constants';
import { makeDraggable } from './drag';
import { wireUpPortLinking, handlePortClick, isLinking } from './linking';
import { wireUpComponentContextMenu } from './componentContextMenu';

function projectOntoSegment(p: Point, a: Point, b: Point): Point {
  if (a.y === b.y) {
    const x = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), p.x));
    return { x, y: a.y };
  }
  const y = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), p.y));
  return { x: a.x, y };
}

/**
 * Wires up "click on a wire while linking" to split it into a junction at that point.
 *
 * Rather than deleting the wire and auto-routing two brand new ones (which could reshape the
 * whole connection into something unrecognizable), this splits the wire's own guide list at
 * the clicked segment: everything before the split becomes the first new wire's guides,
 * everything after becomes the second's, so both halves keep the exact path the original wire
 * already had, joined by a small junction dot right at the click point.
 */
export function initWireSplitting(
  compLayer: HTMLElement,
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
): void {
  setWireClickInterceptor((conn, clientX, clientY) => {
    if (!isLinking()) return false;

    const clickWorld = viewport.clientToWorld(clientX, clientY);
    const anchors = computeConnectionAnchors(viewport, workspaceEl, conn);
    if (!anchors) return false;
    const { fromAnchor, toAnchor } = anchors;

    // Ensure the wire has an editable guide list matching its current visual shape, so there's
    // something concrete to split - a still-auto-routed wire has none yet.
    if (conn.guides.length === 0) {
      const stubOut0 = stubPoint(fromAnchor, toAnchor.pos, conn.stubStartLen ?? WIRE_STUB);
      const stubIn0 = stubPoint(toAnchor, fromAnchor.pos, conn.stubEndLen ?? WIRE_STUB);
      const points = computeConnectionGeometry(viewport, workspaceEl, conn);
      conn.guides = seedGuidesFromPoints(points, stubOut0, stubIn0);
    }

    const stubIn = stubPoint(toAnchor, fromAnchor.pos, conn.stubEndLen ?? WIRE_STUB);
    const corners = guideCorners(fromAnchor, toAnchor, conn.guides, conn.stubStartLen);
    const allPoints: Point[] = [...corners, stubIn];

    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < allPoints.length - 1; i++) {
      const a = allPoints[i] as Point;
      const b = allPoints[i + 1] as Point;
      const d = distPointToSegment(clickWorld, a, b);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return false;

    const a = allPoints[bestIdx] as Point;
    const b = allPoints[bestIdx + 1] as Point;
    const junctionPos = projectOntoSegment(clickWorld, a, b);
    const junctionOrientation: 'H' | 'V' = a.y === b.y ? 'H' : 'V';

    const junction = createJunction(compLayer, junctionPos.x, junctionPos.y, junctionOrientation);
    appState.addComponent(junction);
    makeDraggable(junction, viewport);
    wireUpPortLinking(junction);
    wireUpComponentContextMenu(junction);

    const { from: originalFrom, to: originalTo, stubStartLen, stubEndLen } = conn;
    const firstGuides = conn.guides.slice(0, bestIdx);
    const secondGuides = conn.guides.slice(bestIdx);

    removeConnection(conn.id);

    const firstConn = createConnection(originalFrom, { id: junction.id, port: 'P' });
    firstConn.guides = firstGuides;
    firstConn.stubStartLen = stubStartLen;
    redrawConnection(firstConn);

    const secondConn = createConnection({ id: junction.id, port: 'P' }, originalTo);
    secondConn.guides = secondGuides;
    secondConn.stubEndLen = stubEndLen;
    redrawConnection(secondConn);

    handlePortClick(junction.id, 'P');
    return true;
  });
}
