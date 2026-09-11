import type { WireGuide } from '../core/types';
import { WIRE_STUB } from '../sim/constants';

export interface Point {
  x: number;
  y: number;
}

export interface PortAnchor {
  pos: Point;
  entryOrientation: 'H' | 'V';
  pilotDir?: 1 | -1;
}

export function pathFromPoints(points: Point[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function distPointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function hitTestWire(points: Point[], p: Point, threshold: number): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b && distPointToSegment(p, a, b) <= threshold) return true;
  }
  return false;
}

export function collapseColinear(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0] as Point];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1] as Point;
    const cur = points[i] as Point;
    const next = points[i + 1] as Point;
    const sameLineHoriz = prev.y === cur.y && cur.y === next.y;
    const sameLineVert = prev.x === cur.x && cur.x === next.x;
    if (!sameLineHoriz && !sameLineVert) out.push(cur);
  }
  out.push(points[points.length - 1] as Point);
  return out;
}

export function stubPoint(anchor: PortAnchor, towardPos: Point, len: number): Point {
  const { pos, entryOrientation, pilotDir } = anchor;
  if (entryOrientation === 'H') {
    const dir = pilotDir ?? (towardPos.x >= pos.x ? 1 : -1);
    return { x: pos.x + dir * len, y: pos.y };
  }
  const dir = pilotDir ?? (towardPos.y >= pos.y ? 1 : -1);
  return { x: pos.x, y: pos.y + dir * len };
}

/** Default orthogonal auto-route: stub out of each port, then one corner between them. */
export function routeAuto(
  from: PortAnchor,
  to: PortAnchor,
  stubStartLen: number | null = null,
  stubEndLen: number | null = null,
): Point[] {
  const stubOut = stubPoint(from, to.pos, stubStartLen ?? WIRE_STUB);
  const stubIn = stubPoint(to, from.pos, stubEndLen ?? WIRE_STUB);

  const points: Point[] = [from.pos, stubOut];
  if (stubOut.x !== stubIn.x && stubOut.y !== stubIn.y) {
    points.push({ x: stubIn.x, y: stubOut.y });
  }
  points.push(stubIn, to.pos);
  return collapseColinear(points);
}

/** Point at half the total length along a polyline, for placing a wire's pressure label. */
export function polylineMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0] as Point;

  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLengths.push(len);
    total += len;
  }

  let remaining = total / 2;
  for (let i = 0; i < segLengths.length; i++) {
    const len = segLengths[i] as number;
    if (remaining <= len) {
      const a = points[i] as Point;
      const b = points[i + 1] as Point;
      const t = len === 0 ? 0 : remaining / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= len;
  }
  return points[points.length - 1] as Point;
}

/** Routes through user-placed guides: each guide fixes one axis of the next bend point. */
export function routeWithGuides(
  from: PortAnchor,
  to: PortAnchor,
  guides: WireGuide[],
  stubStartLen: number | null = null,
  stubEndLen: number | null = null,
): Point[] {
  const stubOut = stubPoint(from, to.pos, stubStartLen ?? WIRE_STUB);
  const stubIn = stubPoint(to, from.pos, stubEndLen ?? WIRE_STUB);

  const points: Point[] = [from.pos, stubOut];
  let cur = stubOut;
  for (const g of guides) {
    const next = g.type === 'H' ? { x: cur.x, y: g.pos } : { x: g.pos, y: cur.y };
    points.push(next);
    cur = next;
  }
  points.push(stubIn, to.pos);
  return collapseColinear(points);
}
