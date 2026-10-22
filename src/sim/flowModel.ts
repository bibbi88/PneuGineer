/**
 * The physics behind flow simulation mode (as opposed to the default logic mode, where a line
 * simply has air or not): compressible flow through restrictions, chamber pressures that build
 * up and fall as air moves, and a piston driven by the pressures on either side of it.
 *
 * Aimed at behaving realistically for teaching - believable speeds, pressures that take time to
 * build, throttles that actually slow things down, a cylinder that stalls against a load - not
 * at reproducing a particular manufacturer's data sheet. Temperatures are taken as constant
 * (room temperature), which keeps the model simple and is a good approximation for the slow,
 * small-volume circuits used in training.
 */

/** Atmospheric pressure, Pa. Gauge pressures (what the app shows, in bar) are relative to this. */
export const P_ATM = 101_325;
/** Specific gas constant of air, J/(kg K). */
const R_AIR = 287;
/** Room temperature, K - air is assumed to stay at it. */
const T_AIR = 293.15;
/** Density of air at ISO 8778 reference conditions (ANR: 1 bar abs, 20 °C), kg/m³. */
const RHO_ANR = 1.185;
/** Polytropic exponent for chamber compression/expansion - between isothermal (1.0) and
 * adiabatic (1.4), the usual working value for pneumatic cylinders. */
const POLYTROPIC_N = 1.2;

export const BAR = 100_000;

/** Default flow capacity of the line from the supply through a directional valve to a cylinder
 * port (and from the port back out to exhaust), as an ISO 6358 sonic conductance in
 * dm³/(s·bar). About what a training rig's small valves and 4 mm tubing give. A throttle in the
 * path scales it down. */
export const DEFAULT_PATH_CONDUCTANCE = 0.4;
/** ISO 6358 critical pressure ratio: below it the flow is choked (no longer depends on the
 * downstream pressure). 0.3 is a typical value for valves and fittings. */
export const DEFAULT_CRITICAL_RATIO = 0.3;

/** Integration step, s. The chamber pressures react within milliseconds, so a display frame
 * (up to 50 ms) is split into steps this long. */
export const SUBSTEP = 0.0005;

/**
 * Mass flow, kg/s, from absolute pressure `p1` to absolute pressure `p2` (Pa) through a
 * restriction of sonic conductance `conductance` (dm³/(s·bar)) and critical pressure ratio `b`,
 * per ISO 6358. Negative when air flows the other way (p2 > p1).
 */
export function isoMassFlow(
  p1: number,
  p2: number,
  conductance: number,
  b: number = DEFAULT_CRITICAL_RATIO,
): number {
  if (conductance <= 0 || p1 === p2) return 0;
  if (p2 > p1) return -isoMassFlow(p2, p1, conductance, b);
  const r = p2 / p1;
  const phi = flowFactor(r, b);
  // C in m³/(s·Pa): 1 dm³/(s·bar) = 1e-3 m³/s per 1e5 Pa.
  const cSi = conductance * 1e-8;
  return cSi * p1 * RHO_ANR * phi;
}

/** Below this pressure difference (as a share of the upstream pressure), flow is taken to be
 * proportional to the difference - the near-laminar region close to equilibrium. The ISO 6358
 * curve itself is infinitely steep there, which a time-stepped simulation can only follow by
 * overshooting back and forth around the equilibrium for ever. */
const LINEAR_BAND = 0.02;

/** ISO 6358 flow factor for pressure ratio `r` (downstream/upstream): 1 when choked, falling to
 * 0 at r = 1 - linear over the last LINEAR_BAND. */
export function flowFactor(r: number, b: number): number {
  const curve = (x: number): number =>
    x <= b ? 1 : Math.sqrt(Math.max(0, 1 - ((x - b) / (1 - b)) ** 2));
  const edge = 1 - LINEAR_BAND;
  if (r <= edge) return curve(r);
  return (curve(edge) * (1 - r)) / LINEAR_BAND;
}

/** How a cylinder port is connected this instant, as far as the flow model is concerned. */
export type PortFeed =
  /** To the supply, at absolute pressure `pressure` (Pa), through conductance `conductance`. */
  | { kind: 'supply'; pressure: number; conductance: number; b?: number }
  /** Out to atmosphere through conductance `conductance`. */
  | { kind: 'exhaust'; conductance: number; b?: number }
  /** Shut off: no air in or out. */
  | { kind: 'closed' }
  /** Joined to a line at absolute pressure `pressure` (Pa) through `conductance` - air flows
   * whichever way the pressures say (flow mode's network, see sim/flowNetwork.ts). */
  | { kind: 'node'; pressure: number; conductance: number; b?: number };

export interface CylinderSpec {
  /** Piston area on the A (cap) side, m². */
  areaA: number;
  /** Piston area on the B (rod) side, m² - the bore less the rod. */
  areaB: number;
  /** Stroke, m. */
  stroke: number;
  /** Moving mass (piston, rod and whatever it carries), kg. */
  mass: number;
  /** External force opposing extension, N (negative: pulling the rod out). */
  load: number;
  /** Dead volume of each chamber at its end of stroke, including the line to the valve, m³. */
  deadVolume: number;
  /** Coulomb (dry) friction of the seals, N. */
  friction: number;
  /** Viscous friction, N per m/s. */
  damping: number;
}

export interface CylinderState {
  /** Absolute chamber pressures, Pa. */
  pA: number;
  pB: number;
  /** Piston position from fully retracted, m (0..stroke). */
  x: number;
  /** Piston velocity, m/s (positive extending). */
  v: number;
}

export interface CylinderFlows {
  /** Mass flow into each chamber, kg/s (negative: out), averaged over the step. */
  qA: number;
  qB: number;
}

export function atRest(x = 0): CylinderState {
  return { pA: P_ATM, pB: P_ATM, x, v: 0 };
}

function chamberFlow(p: number, feed: PortFeed): number {
  if (feed.kind === 'supply') {
    // The supply holds its pressure; air only flows in from it, never back up the line (a
    // chamber above supply pressure just stops filling - it doesn't drive the supply).
    return Math.max(0, isoMassFlow(feed.pressure, p, feed.conductance, feed.b));
  }
  if (feed.kind === 'exhaust') return isoMassFlow(p, P_ATM, feed.conductance, feed.b) * -1;
  if (feed.kind === 'node') return isoMassFlow(feed.pressure, p, feed.conductance, feed.b);
  return 0;
}

/** Advances a cylinder by `dt` seconds (any length - it's split into SUBSTEPs), mutating and
 * returning `state`, and reports the average flow into each chamber over that time. */
export function stepCylinder(
  state: CylinderState,
  spec: CylinderSpec,
  feedA: PortFeed,
  feedB: PortFeed,
  dt: number,
): CylinderFlows {
  const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
  const h = dt / steps;
  const rt = R_AIR * T_AIR;
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < steps; i++) {
    const qA = chamberFlow(state.pA, feedA);
    const qB = chamberFlow(state.pB, feedB);
    sumA += qA;
    sumB += qB;

    // Chamber volumes and how fast they're changing.
    const vA = spec.areaA * state.x + spec.deadVolume;
    const vB = spec.areaB * (spec.stroke - state.x) + spec.deadVolume;
    const dvA = spec.areaA * state.v;
    const dvB = -spec.areaB * state.v;
    state.pA += (POLYTROPIC_N * (rt * qA - state.pA * dvA) * h) / vA;
    state.pB += (POLYTROPIC_N * (rt * qB - state.pB * dvB) * h) / vB;
    // Air can't go below a vacuum, and a chamber vented to atmosphere settles at atmospheric.
    state.pA = Math.max(state.pA, 1);
    state.pB = Math.max(state.pB, 1);

    // Pressure force (gauge on both sides: atmosphere acts on the rod's own cross-section).
    const drive = (state.pA - P_ATM) * spec.areaA - (state.pB - P_ATM) * spec.areaB - spec.load;
    movePiston(state, drive, spec, h);
  }

  return { qA: sumA / steps, qB: sumB / steps };
}

/** One integration step of the piston: `drive` is the net force on it (N, positive extending)
 * before friction. Static friction holds it until `drive` exceeds it; moving, it's opposed by
 * friction and damping, and it stops dead at either end stop. */
function movePiston(
  state: { x: number; v: number },
  drive: number,
  spec: { mass: number; friction: number; damping: number; stroke: number },
  h: number,
): void {
  if (Math.abs(state.v) < 1e-6 && Math.abs(drive) <= spec.friction) {
    state.v = 0;
  } else {
    const dir = state.v !== 0 ? Math.sign(state.v) : Math.sign(drive);
    const accel = (drive - dir * spec.friction - spec.damping * state.v) / spec.mass;
    const vNext = state.v + accel * h;
    // Friction can stop the piston, never push it back the other way.
    state.v = state.v !== 0 && Math.sign(vNext) !== Math.sign(state.v) ? 0 : vNext;
  }
  state.x += state.v * h;
  if (state.x <= 0) {
    state.x = 0;
    if (state.v < 0) state.v = 0;
  } else if (state.x >= spec.stroke) {
    state.x = spec.stroke;
    if (state.v > 0) state.v = 0;
  }
}

export interface SingleCylinderSpec {
  /** Area the air acts on, m² - the full bore when it pushes the rod out, the bore less the rod
   * when it pulls it in. */
  area: number;
  /** +1: air extends the rod (its chamber is at the cap end, growing as the rod comes out);
   * -1: air retracts it (chamber at the rod end, growing as the rod goes in). */
  airDirection: 1 | -1;
  stroke: number;
  mass: number;
  /** External force opposing extension, N. */
  load: number;
  deadVolume: number;
  friction: number;
  damping: number;
  /** Where the spring returns the piston to, m (0 or stroke). */
  restX: number;
  /** Spring force at its rest position, N, and how much it grows per metre compressed. */
  springPreload: number;
  springRate: number;
}

export interface SingleCylinderState {
  /** Absolute pressure in the air chamber, Pa (the spring side is vented to atmosphere). */
  p: number;
  x: number;
  v: number;
}

/** Advances a single-acting cylinder by `dt` seconds, mutating `state`; returns the average
 * mass flow into its air chamber, kg/s. */
export function stepSingleCylinder(
  state: SingleCylinderState,
  spec: SingleCylinderSpec,
  feed: PortFeed,
  dt: number,
): number {
  const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
  const h = dt / steps;
  const rt = R_AIR * T_AIR;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const q = chamberFlow(state.p, feed);
    sum += q;
    const travel = spec.airDirection > 0 ? state.x : spec.stroke - state.x;
    const volume = spec.area * travel + spec.deadVolume;
    const dV = spec.area * state.v * spec.airDirection;
    state.p += (POLYTROPIC_N * (rt * q - state.p * dV) * h) / volume;
    state.p = Math.max(state.p, 1);

    const compressed = Math.abs(state.x - spec.restX);
    const springToward =
      spec.restX > state.x || (spec.restX === state.x && spec.restX > 0) ? 1 : -1;
    const spring = springToward * (spec.springPreload + spec.springRate * compressed);
    const drive = spec.airDirection * (state.p - P_ATM) * spec.area + spring - spec.load;
    movePiston(state, drive, spec, h);
  }
  return sum / steps;
}

/** Standard volumetric flow (ANR, litres per minute) for a mass flow in kg/s - how air
 * consumption and valve flow are usually quoted. */
export function toNormalLitresPerMinute(massFlow: number): number {
  return (massFlow / RHO_ANR) * 1000 * 60;
}

/** Gauge pressure in bar for an absolute pressure in Pa. */
export function toGaugeBar(pAbs: number): number {
  return (pAbs - P_ATM) / BAR;
}

/** Absolute pressure in Pa for a gauge pressure in bar. */
export function fromGaugeBar(bar: number): number {
  return bar * BAR + P_ATM;
}
