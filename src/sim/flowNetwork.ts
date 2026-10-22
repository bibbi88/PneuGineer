/**
 * Flow mode's pneumatic network: the circuit as volumes joined by restrictions, so pressure
 * exists everywhere - in every line, not just in cylinder chambers - and builds up and falls as
 * air actually moves (see docs/flow-simulation.md).
 *
 * - A *net* is a set of ports joined by wires (and junctions): one line, at one pressure. Its
 *   volume is the tubing the wires represent plus a little per fitting.
 * - Fixed nets: any net holding a supply port sits at supply pressure; a port with nothing wired
 *   to it is open to atmosphere (a valve's exhaust, a throttle's free end).
 * - Every path a component currently opens (its `conductivityRule`, as the logic graph sees it)
 *   is a restriction between two nets, passing air per ISO 6358 at the component's flow rating
 *   (sim/flowRatings.ts), scaled by its `flowMultiplier` (a throttle's setting). A directed path (a check valve)
 *   passes air one way only; a pressure reducing valve only while its outlet is below its set
 *   pressure.
 * - Devices (cylinders, see `Component.flowDevice`) hold their own volumes and exchange air with
 *   the nets at their ports.
 *
 * Which valve paths are open still comes from the logic graph; this works out the pressures and
 * flows that result.
 */
import type { Component, PortKey } from '../core/types';
import { appState } from '../app/AppState';
import { SOURCE_PRESSURE } from './constants';
import { isoMassFlow, P_ATM, BAR, fromGaugeBar } from './flowModel';
import { portKey, type FrameGraph, type PortKeyStr } from './pressure';
import { criticalRatioOf, flowRatingOf } from './flowRatings';

/** Bore of the tubing a wire stands for (4 mm), m². */
const TUBE_AREA = Math.PI * 0.002 ** 2;
/** Metres of tubing per pixel of drawn wire - a 300 px line is 0.6 m of tube. */
const METRES_PER_PX = 0.002;
/** Volume of the fitting at each port, m³ - also keeps a line with no drawn length finite. */
const FITTING_VOLUME = 1e-6;
/** Integration step, s - lines are small volumes and react within milliseconds. */
const SUBSTEP = 0.0002;
/** Pressure band, bar, over which a pressure reducing valve closes as its outlet nears the set
 * pressure (rather than snapping shut, which would make the outlet pressure chatter). */
const REGULATOR_BAND = 0.3;
const RT = 287 * 293.15;

/** A component that holds air of its own and exchanges it with the nets at its ports. */
export interface FlowDevice {
  ports: PortKey[];
  /** Advance by `h` seconds, given each port's net pressure (absolute, Pa); returns the mass
   * flow into the device through each port, kg/s (negative: out of it). */
  substep(h: number, netPressure: (port: PortKey) => number): Record<PortKey, number>;
}

interface Net {
  key: string;
  ports: PortKeyStr[];
  volume: number;
  /** null: free (its pressure follows the air in it); a number: held at that pressure, Pa. */
  fixed: number | null;
  /** Held at supply pressure by a source (rather than open to atmosphere). */
  supply: boolean;
}

interface Topology {
  version: number;
  nets: Net[];
  netOf: Map<PortKeyStr, Net>;
}

let topology: Topology | null = null;
/** Pressure of every free net, by net key, Pa. Survives a topology change (see buildTopology). */
let pressures = new Map<string, number>();
/** The latest pressure at every port, gauge bar - what the rest of the app reads. */
let portPressure = new Map<PortKeyStr, number>();
/** Air drawn from the supply over the last frame, kg/s, at every port of a supply net. */
let supplyRate = new Map<PortKeyStr, number>();

/** Forget all pressures - every line back to atmospheric. Called when the simulation stops. */
export function resetFlowNetwork(): void {
  topology = null;
  pressures = new Map();
  portPressure = new Map();
  supplyRate = new Map();
}

/** Air drawn from the supply at a source's port over the last flow step, kg/s - its air
 * consumption - or null outside flow mode. */
export function flowSupplyRate(key: PortKeyStr): number | null {
  return supplyRate.get(key) ?? null;
}

/** Gauge pressure (bar) at a port as of the last flow step, or null if flow mode hasn't
 * computed one (logic mode, or the simulation isn't running). */
export function flowPressureAt(key: PortKeyStr): number | null {
  return portPressure.get(key) ?? null;
}

function pathLength(d: string | null): number {
  if (!d) return 0;
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let len = 0;
  for (let i = 2; i + 1 < nums.length; i += 2) {
    len += Math.abs((nums[i] as number) - (nums[i - 2] as number));
    len += Math.abs((nums[i + 1] as number) - (nums[i - 1] as number));
  }
  return len;
}

function buildTopology(components: Component[]): Topology {
  // Union-find over every pneumatic port, joined by wires.
  const parent = new Map<PortKeyStr, PortKeyStr>();
  const find = (k: PortKeyStr): PortKeyStr => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r) as PortKeyStr;
    parent.set(k, r);
    return r;
  };
  for (const c of components) {
    for (const p of Object.values(c.ports)) {
      if (!p.electrical) parent.set(portKey(c.id, p.key), portKey(c.id, p.key));
    }
  }
  const wired = new Set<PortKeyStr>();
  const wires: Array<{ a: PortKeyStr; length: number }> = [];
  for (const conn of appState.connections) {
    const a = portKey(conn.from.id, conn.from.port);
    const b = portKey(conn.to.id, conn.to.port);
    if (!parent.has(a) || !parent.has(b)) continue;
    wired.add(a);
    wired.add(b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
    wires.push({ a, length: pathLength(conn.pathEl.getAttribute('d')) });
  }
  // Every wire's tubing belongs to the net it ended up in.
  const wireLength = new Map<PortKeyStr, number>();
  for (const w of wires) {
    const r = find(w.a);
    wireLength.set(r, (wireLength.get(r) ?? 0) + w.length);
  }

  const sourcePorts = new Set<PortKeyStr>();
  for (const c of components) {
    for (const p of c.sourcePorts?.() ?? []) sourcePorts.add(portKey(c.id, p));
  }

  const groups = new Map<PortKeyStr, PortKeyStr[]>();
  for (const k of parent.keys()) {
    const r = find(k);
    groups.set(r, [...(groups.get(r) ?? []), k]);
  }
  const nets: Net[] = [];
  const netOf = new Map<PortKeyStr, Net>();
  for (const [root, ports] of groups) {
    ports.sort();
    const hasSource = ports.some((p) => sourcePorts.has(p));
    const open = ports.length === 1 && !wired.has(ports[0] as PortKeyStr);
    const net: Net = {
      key: ports[0] as string,
      ports,
      volume:
        (wireLength.get(root) ?? 0) * METRES_PER_PX * TUBE_AREA + FITTING_VOLUME * ports.length,
      fixed: hasSource ? fromGaugeBar(SOURCE_PRESSURE) : open ? P_ATM : null,
      supply: hasSource,
    };
    nets.push(net);
    for (const p of ports) netOf.set(p, net);
  }

  // Carry pressures over from the previous topology, port by port, so adding or removing a
  // wire mid-run doesn't empty every line.
  if (topology) {
    const carried = new Map<string, number>();
    for (const net of nets) {
      if (net.fixed !== null) continue;
      for (const p of net.ports) {
        const old = topology.netOf.get(p);
        const pOld = old ? pressures.get(old.key) : undefined;
        if (pOld !== undefined) {
          carried.set(net.key, Math.max(carried.get(net.key) ?? 0, pOld));
        }
      }
    }
    pressures = carried;
  }

  return { version: appState.topologyVersion, nets, netOf };
}

interface Edge {
  a: Net;
  b: Net;
  /** Conductance from a to b and from b to a; 0 blocks that direction. */
  cAB: number;
  cBA: number;
  /** A pressure reducing valve's set pressure (absolute, Pa) on the a -> b direction. */
  capAB: number | null;
  /** The component's critical pressure ratio b. */
  criticalRatio: number;
}

function buildEdges(
  components: Component[],
  graph: FrameGraph,
  topo: Topology,
  pilotActuated?: (key: PortKeyStr) => boolean,
): Edge[] {
  const edges: Edge[] = [];
  for (const c of components) {
    // The same view of each port the logic graph took - pilots by their real pressure.
    const rules = c.conductivityRule({
      isPressurized: (p) =>
        pilotActuated && c.ports[p]?.isPilot
          ? pilotActuated(portKey(c.id, p))
          : graph.pressurized.has(portKey(c.id, p)),
    });
    const rating = flowRatingOf(c);
    const criticalRatio = criticalRatioOf(c);
    for (const rule of rules) {
      const a = topo.netOf.get(portKey(c.id, rule.a));
      const b = topo.netOf.get(portKey(c.id, rule.b));
      if (!a || !b || a === b) continue;
      const cap = c.pressureLimit?.(rule.a, rule.b);
      edges.push({
        a,
        b,
        cAB: rating * (c.flowMultiplier?.(rule.a, rule.b) ?? 1),
        cBA: rule.directed ? 0 : rating * (c.flowMultiplier?.(rule.b, rule.a) ?? 1),
        capAB: cap === null || cap === undefined ? null : fromGaugeBar(cap),
        criticalRatio,
      });
    }
  }
  return edges;
}

function edgeFlow(e: Edge, pa: number, pb: number): number {
  if (pa > pb) {
    let c = e.cAB;
    if (e.capAB !== null) {
      // A regulator: open while the outlet is below its setting, closing over the last bit.
      c *= Math.min(1, Math.max(0, (e.capAB - pb) / (REGULATOR_BAND * BAR)));
    }
    return isoMassFlow(pa, pb, c, e.criticalRatio);
  }
  // Backwards through a regulator is blocked (a plain, non-relieving one).
  if (e.capAB !== null) return 0;
  return isoMassFlow(pa, pb, e.cBA, e.criticalRatio);
}

/**
 * Advances the network by `dt` seconds against the logic graph's current valve states: moves
 * air between nets and into/out of devices, then records every port's pressure (see
 * `flowPressureAt`). Call once per frame in flow mode, before components' own step().
 */
export function stepFlowNetwork(
  components: Component[],
  graph: FrameGraph,
  dt: number,
  pilotActuated?: (key: PortKeyStr) => boolean,
): void {
  if (!topology || topology.version !== appState.topologyVersion) {
    topology = buildTopology(components);
  }
  const topo = topology;
  const edges = buildEdges(components, graph, topo, pilotActuated);
  const devices: Array<{ comp: Component; device: FlowDevice }> = [];
  for (const c of components) {
    const device = c.flowDevice?.();
    if (device) devices.push({ comp: c, device });
  }

  const pressureOf = (net: Net): number => net.fixed ?? pressures.get(net.key) ?? P_ATM;
  for (const net of topo.nets) {
    if (net.fixed === null && !pressures.has(net.key)) pressures.set(net.key, P_ATM);
  }

  const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
  const h = dt / steps;
  const massIn = new Map<Net, number>();
  const drawn = new Map<Net, number>();
  for (let s = 0; s < steps; s++) {
    massIn.clear();
    const add = (net: Net, q: number): void => {
      if (net.fixed === null) massIn.set(net, (massIn.get(net) ?? 0) + q);
      else if (net.supply) drawn.set(net, (drawn.get(net) ?? 0) - q * h);
    };
    for (const e of edges) {
      const pa = pressureOf(e.a);
      const pb = pressureOf(e.b);
      let q = edgeFlow(e, pa, pb);
      // Never move more air in one step than would bring the two sides level (half of it, as
      // other paths may be filling or emptying the same line at the same time).
      const give =
        (e.a.fixed === null ? 1 / e.a.volume : 0) + (e.b.fixed === null ? 1 / e.b.volume : 0);
      if (give > 0) {
        const level = Math.abs(pa - pb) / (RT * give) / h;
        q = Math.max(-0.5 * level, Math.min(0.5 * level, q));
      }
      add(e.a, -q);
      add(e.b, q);
    }
    for (const { comp, device } of devices) {
      const flows = device.substep(h, (port) => {
        const net = topo.netOf.get(portKey(comp.id, port));
        return net ? pressureOf(net) : P_ATM;
      });
      for (const [port, q] of Object.entries(flows)) {
        const net = topo.netOf.get(portKey(comp.id, port));
        if (net) add(net, -q);
      }
    }
    // Isothermal lines: p = m R T / V, so dp = R T dm / V.
    for (const [net, q] of massIn) {
      const p = pressureOf(net) + (RT * q * h) / net.volume;
      pressures.set(net.key, Math.max(1, p));
    }
  }

  portPressure = new Map();
  supplyRate = new Map();
  for (const net of topo.nets) {
    const bar = (pressureOf(net) - P_ATM) / BAR;
    for (const p of net.ports) portPressure.set(p, bar);
    if (net.supply) {
      // Shared between the net's sources - several sources on one line split its draw.
      const sources = net.ports.filter((p) => graph.sourceKeys.has(p)).length || 1;
      const rate = (drawn.get(net) ?? 0) / dt / sources;
      for (const p of net.ports) supplyRate.set(p, rate);
    }
  }
}
