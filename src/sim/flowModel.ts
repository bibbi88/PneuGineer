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
  const phi = r <= b ? 1 : Math.sqrt(Math.max(0, 1 - ((r - b) / (1 - b)) ** 2));
  // C in m³/(s·Pa): 1 dm³/(s·bar) = 1e-3 m³/s per 1e5 Pa.
  const cSi = conductance * 1e-8;
  return cSi * p1 * RHO_ANR * phi;
}

/** How a cylinder port is connected this instant, as far as the flow model is concerned. */
export type PortFeed =
  /** To the supply, at absolute pressure `pressure` (Pa), through conductance `conductance`. */
  | { kind: 'supply'; pressure: number; conductance: number }
  /** Out to atmosphere through conductance `conductance`. */
  | { kind: 'exhaust'; conductance: number }
  /** Shut off: no air in or out. */
  | { kind: 'closed' };

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
    return Math.max(0, isoMassFlow(feed.pressure, p, feed.conductance));
  }
  if (feed.kind === 'exhaust') return isoMassFlow(p, P_ATM, feed.conductance) * -1;
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

    if (Math.abs(state.v) < 1e-6 && Math.abs(drive) <= spec.friction) {
      // Static friction holds it.
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

  return { qA: sumA / steps, qB: sumB / steps };
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
