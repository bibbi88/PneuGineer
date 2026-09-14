import type { Component, ComponentId, Connection, PortKey } from '../core/types';

export type PortKeyStr = string;

export function portKey(id: ComponentId, port: PortKey): PortKeyStr {
  return `${id}:${port}`;
}

export interface FrameGraph {
  pressurized: Set<PortKeyStr>;
  /** Directed weighted adjacency: neighbor -> multiplier to apply when flow crosses that edge. */
  adjacency: Map<PortKeyStr, Map<PortKeyStr, number>>;
  sourceKeys: Set<PortKeyStr>;
}

export function emptyFrameGraph(): FrameGraph {
  return { pressurized: new Set(), adjacency: new Map(), sourceKeys: new Set() };
}

interface WireAdjacencyCache {
  version: number;
  adjacency: Map<PortKeyStr, Set<PortKeyStr>>;
}

let wireCache: WireAdjacencyCache | null = null;

/** Wire-only adjacency, rebuilt only when the topology (components/connections) actually changes. */
function getWireAdjacency(
  connections: Connection[],
  topologyVersion: number,
): Map<PortKeyStr, Set<PortKeyStr>> {
  if (wireCache && wireCache.version === topologyVersion) return wireCache.adjacency;

  const adjacency = new Map<PortKeyStr, Set<PortKeyStr>>();
  for (const conn of connections) {
    const a = portKey(conn.from.id, conn.from.port);
    const b = portKey(conn.to.id, conn.to.port);
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }

  wireCache = { version: topologyVersion, adjacency };
  return adjacency;
}

function addDirEdge(
  adjacency: Map<PortKeyStr, Map<PortKeyStr, number>>,
  a: PortKeyStr,
  b: PortKeyStr,
  multiplier: number,
): void {
  if (!adjacency.has(a)) adjacency.set(a, new Map());
  adjacency.get(a)?.set(b, multiplier);
}

function flood(
  adjacency: Map<PortKeyStr, Map<PortKeyStr, number>>,
  pressurized: Set<PortKeyStr>,
): void {
  const queue = [...pressurized];
  while (queue.length > 0) {
    const cur = queue.shift() as PortKeyStr;
    for (const next of adjacency.get(cur)?.keys() ?? []) {
      if (!pressurized.has(next)) {
        pressurized.add(next);
        queue.push(next);
      }
    }
  }
}

/**
 * Builds this frame's pressure state: seeds from every component's source ports, then floods
 * over wires plus each component's current conductivity rule, iterating to a fixed point
 * (valve/AND/OR-style rules can only become newly satisfied as more ports light up).
 * The wire adjacency itself is cached by topologyVersion; only this per-frame dynamic overlay
 * (component-internal conductivity, which can depend on current pressurized state) is rebuilt
 * every call, and that part stays cheap (O(components) per pass, 1-3 passes to converge).
 */
export function computeFrameGraph(
  components: Component[],
  connections: Connection[],
  topologyVersion: number,
): FrameGraph {
  const wireAdjacency = getWireAdjacency(connections, topologyVersion);

  const adjacency = new Map<PortKeyStr, Map<PortKeyStr, number>>();
  for (const [a, neighbors] of wireAdjacency) {
    for (const b of neighbors) addDirEdge(adjacency, a, b, 1);
  }

  const pressurized = new Set<PortKeyStr>();
  const sourceKeys = new Set<PortKeyStr>();
  for (const c of components) {
    for (const p of c.sourcePorts?.() ?? []) {
      const key = portKey(c.id, p);
      pressurized.add(key);
      sourceKeys.add(key);
    }
  }
  flood(adjacency, pressurized);

  let changed = true;
  while (changed) {
    const sizeBefore = pressurized.size;
    for (const c of components) {
      const edges = c.conductivityRule({ isPressurized: (p) => pressurized.has(portKey(c.id, p)) });
      for (const edge of edges) {
        const a = portKey(c.id, edge.a);
        const b = portKey(c.id, edge.b);
        // Each direction gets its own multiplier lookup - a component like the one-way flow
        // control valve conducts both ways on one undirected edge but throttles only one of
        // them, so reusing a single (edge.a, edge.b) multiplier for both directions would
        // silently apply the free-flow rate to the throttled direction too.
        addDirEdge(adjacency, a, b, c.flowMultiplier?.(edge.a, edge.b) ?? 1);
        if (!edge.directed) addDirEdge(adjacency, b, a, c.flowMultiplier?.(edge.b, edge.a) ?? 1);
      }
    }
    flood(adjacency, pressurized);
    changed = pressurized.size > sizeBefore;
  }

  return { pressurized, adjacency, sourceKeys };
}

/**
 * Shortest-hop path from `fromKey` to any currently-pressurized source, multiplying each edge's
 * flow multiplier along the way. Returns 0 if no pressurized source is reachable.
 */
export function flowMultiplierToNearestSource(graph: FrameGraph, fromKey: PortKeyStr): number {
  const queue: Array<{ key: PortKeyStr; mult: number }> = [{ key: fromKey, mult: 1 }];
  const visited = new Set<PortKeyStr>([fromKey]);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    if (graph.sourceKeys.has(cur.key) && graph.pressurized.has(cur.key)) return cur.mult;

    for (const [next] of graph.adjacency.get(cur.key) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        // This walk goes from the query port back toward a source, i.e. backwards relative to
        // the direction air actually flows. The multiplier that matters is the one for the real
        // flow direction (next -> cur, since next sits closer to the source), not the multiplier
        // stored on the edge this walk just traversed (cur -> next) - those two can differ for
        // an asymmetric-but-undirected edge like the one-way flow control valve, which conducts
        // both ways but only throttles one of them.
        const realMult = graph.adjacency.get(next)?.get(cur.key) ?? 1;
        queue.push({ key: next, mult: cur.mult * realMult });
      }
    }
  }

  return 0;
}
