import type { Component, ComponentId } from '../core/types';
import { collapseColinear, stubPoint, type Point, type PortAnchor } from './routing';
import { WIRE_STUB } from '../sim/constants';

const CELL_SIZE = 20;
const OBSTACLE_COST = 8;
const TURN_PENALTY = 4;
const GRID_MARGIN_PX = 80;

interface Grid {
  cellSize: number;
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  cost: Uint8Array;
}

function toCell(grid: Grid, p: Point): { col: number; row: number } {
  const col = Math.max(0, Math.min(grid.cols - 1, Math.round((p.x - grid.minX) / grid.cellSize)));
  const row = Math.max(0, Math.min(grid.rows - 1, Math.round((p.y - grid.minY) / grid.cellSize)));
  return { col, row };
}

function toPoint(grid: Grid, col: number, row: number): Point {
  return { x: grid.minX + col * grid.cellSize, y: grid.minY + row * grid.cellSize };
}

function buildGrid(
  components: Component[],
  excludeIds: Set<ComponentId>,
  from: Point,
  to: Point,
): Grid {
  let minX = Math.min(from.x, to.x) - GRID_MARGIN_PX;
  let maxX = Math.max(from.x, to.x) + GRID_MARGIN_PX;
  let minY = Math.min(from.y, to.y) - GRID_MARGIN_PX;
  let maxY = Math.max(from.y, to.y) + GRID_MARGIN_PX;

  for (const c of components) {
    if (excludeIds.has(c.id)) continue;
    const b = c.getBounds();
    minX = Math.min(minX, b.x - GRID_MARGIN_PX);
    maxX = Math.max(maxX, b.x + b.w + GRID_MARGIN_PX);
    minY = Math.min(minY, b.y - GRID_MARGIN_PX);
    maxY = Math.max(maxY, b.y + b.h + GRID_MARGIN_PX);
  }

  const cols = Math.max(1, Math.ceil((maxX - minX) / CELL_SIZE) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / CELL_SIZE) + 1);
  const cost = new Uint8Array(cols * rows);

  const grid: Grid = { cellSize: CELL_SIZE, minX, minY, cols, rows, cost };

  const padding = 8;
  for (const c of components) {
    if (excludeIds.has(c.id)) continue;
    const b = c.getBounds();
    const topLeft = toCell(grid, { x: b.x - padding, y: b.y - padding });
    const bottomRight = toCell(grid, { x: b.x + b.w + padding, y: b.y + b.h + padding });
    for (let row = topLeft.row; row <= bottomRight.row; row++) {
      for (let col = topLeft.col; col <= bottomRight.col; col++) {
        cost[row * cols + col] = OBSTACLE_COST;
      }
    }
  }

  return grid;
}

interface OpenEntry {
  col: number;
  row: number;
  dir: number;
  g: number;
  f: number;
}

const DIRS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

/** Simple grid A* with a Manhattan heuristic and a penalty for changing direction. */
function astar(
  grid: Grid,
  start: { col: number; row: number },
  goal: { col: number; row: number },
): Point[] | null {
  const { cols, rows, cost } = grid;
  const key = (col: number, row: number, dir: number): string => `${col},${row},${dir}`;

  const startEntry: OpenEntry = { ...start, dir: -1, g: 0, f: 0 };
  const open = new Map<string, OpenEntry>([[key(start.col, start.row, -1), startEntry]]);
  const cameFrom = new Map<string, string>();
  const closed = new Set<string>();
  const bestG = new Map<string, number>([[key(start.col, start.row, -1), 0]]);

  const heuristic = (col: number, row: number): number =>
    Math.abs(goal.col - col) + Math.abs(goal.row - row);

  let goalKey: string | null = null;

  while (open.size > 0) {
    let currentKey = '';
    let current: OpenEntry | null = null;
    for (const [k, entry] of open) {
      if (!current || entry.f < current.f) {
        current = entry;
        currentKey = k;
      }
    }
    if (!current) break;
    open.delete(currentKey);
    closed.add(currentKey);

    if (current.col === goal.col && current.row === goal.row) {
      goalKey = currentKey;
      break;
    }

    for (let dirIdx = 0; dirIdx < DIRS.length; dirIdx++) {
      const dir = DIRS[dirIdx] as { dc: number; dr: number };
      const nCol = current.col + dir.dc;
      const nRow = current.row + dir.dr;
      if (nCol < 0 || nCol >= cols || nRow < 0 || nRow >= rows) continue;

      const nKey = key(nCol, nRow, dirIdx);
      if (closed.has(nKey)) continue;

      const cellCost = 1 + (cost[nRow * cols + nCol] ?? 0);
      const turnCost = current.dir !== -1 && current.dir !== dirIdx ? TURN_PENALTY : 0;
      const g = current.g + cellCost + turnCost;

      const prevBest = bestG.get(nKey);
      if (prevBest !== undefined && g >= prevBest) continue;

      bestG.set(nKey, g);
      cameFrom.set(nKey, currentKey);
      open.set(nKey, { col: nCol, row: nRow, dir: dirIdx, g, f: g + heuristic(nCol, nRow) });
    }
  }

  if (!goalKey) return null;

  const cellPath: Array<{ col: number; row: number }> = [];
  let cur: string | null = goalKey;
  while (cur) {
    const [colStr, rowStr] = cur.split(',');
    cellPath.push({ col: Number(colStr), row: Number(rowStr) });
    cur = cameFrom.get(cur) ?? null;
  }
  cellPath.reverse();

  return cellPath.map((c) => toPoint(grid, c.col, c.row));
}

/**
 * Grid-based orthogonal A* route between two port anchors, routing around (not through)
 * other components. Falls back to the simple one-corner route if no path is found (e.g. the
 * grid is fully boxed in) so a connection is never left unrendered.
 */
export function autoRouteAStar(
  from: PortAnchor,
  to: PortAnchor,
  components: Component[],
  excludeIds: Set<ComponentId>,
  stubStartLen: number | null = null,
  stubEndLen: number | null = null,
): Point[] {
  const stubOut = stubPoint(from, to.pos, stubStartLen ?? WIRE_STUB);
  const stubIn = stubPoint(to, from.pos, stubEndLen ?? WIRE_STUB);

  const grid = buildGrid(components, excludeIds, stubOut, stubIn);
  const startCell = toCell(grid, stubOut);
  const goalCell = toCell(grid, stubIn);

  const gridPath = astar(grid, startCell, goalCell);
  if (!gridPath) {
    const points: Point[] = [from.pos, stubOut];
    if (stubOut.x !== stubIn.x && stubOut.y !== stubIn.y) {
      points.push({ x: stubIn.x, y: stubOut.y });
    }
    points.push(stubIn, to.pos);
    return collapseColinear(points);
  }

  const points: Point[] = [from.pos, stubOut, ...gridPath, stubIn, to.pos];
  return collapseColinear(points);
}
