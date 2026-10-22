/**
 * Flow ratings for flow simulation mode, per ISO 6358: each pneumatic component's sonic
 * conductance C (dm³/(s·bar)) - how much air its paths can pass - and critical pressure ratio b
 * - the downstream/upstream pressure ratio below which that flow is choked (no longer grows as
 * the downstream pressure falls). A component carries its own values once the user sets them in
 * the inspector; until then it has the typical values for its kind below. Figures are typical of
 * the small valves and fittings on a training rig.
 */
import type { Component } from '../core/types';
import { flowFactor } from './flowModel';

/** Typical C per component type, dm³/(s·bar). Types not listed have no air paths to rate. */
export const DEFAULT_FLOW_RATINGS: Readonly<Record<string, number>> = {
  // Directional valves
  valve52: 0.6,
  valve52Mono: 0.6,
  valve53Mono: 0.6,
  valve52Solenoid: 0.6,
  valve52SolenoidDouble: 0.6,
  valve53Solenoid: 0.6,
  airValve32: 0.5,
  pushButton32: 0.3,
  limitValve32: 0.3,
  // Logic
  andValve: 0.5,
  orValve: 0.5,
  // Flow control - for a throttle, the rating fully open (its % setting scales it down)
  checkValve: 0.8,
  throttleValve: 0.6,
  oneWayFlowControlValve: 0.6,
  quickExhaustValve: 1.5,
  pressureReducingValve: 0.8,
  timeDelayValve: 0.4,
  timeDelayValveNO: 0.4,
  timeDelayValveOff: 0.4,
  pressureSequenceValve: 0.4,
  // Measuring: a flow meter barely restricts the line it measures
  flowMeter: 2,
  // Actuators - the port fittings
  cylinderDouble: 0.8,
  cylinderSingle: 0.8,
};

/** Typical b per component type. Poppet valves, check valves and wide-open exhausts sit higher
 * than spool valves; a throttle, a long narrow passage, lower. */
export const DEFAULT_CRITICAL_RATIOS: Readonly<Record<string, number>> = {
  valve52: 0.3,
  valve52Mono: 0.3,
  valve53Mono: 0.3,
  valve52Solenoid: 0.3,
  valve52SolenoidDouble: 0.3,
  valve53Solenoid: 0.3,
  airValve32: 0.35,
  pushButton32: 0.4,
  limitValve32: 0.4,
  andValve: 0.4,
  orValve: 0.4,
  checkValve: 0.45,
  throttleValve: 0.2,
  oneWayFlowControlValve: 0.25,
  quickExhaustValve: 0.5,
  pressureReducingValve: 0.3,
  timeDelayValve: 0.35,
  timeDelayValveNO: 0.35,
  timeDelayValveOff: 0.35,
  pressureSequenceValve: 0.35,
  flowMeter: 0.5,
  cylinderDouble: 0.4,
  cylinderSingle: 0.4,
};

/** Fallbacks for a pneumatic type missing from the tables. */
const FALLBACK = 0.6;
const FALLBACK_B = 0.3;
/** Bounds the inspector accepts: C in dm³/(s·bar), and b (a ratio, below 1 - at 1 nothing would
 * ever flow unchoked). */
export const MIN_FLOW_RATING = 0.01;
export const MAX_FLOW_RATING = 50;
export const MIN_CRITICAL_RATIO = 0;
export const MAX_CRITICAL_RATIO = 0.99;

export function hasFlowRating(type: string): boolean {
  return type in DEFAULT_FLOW_RATINGS;
}

/** Scale on the typical ratings above, for teaching: at their real-world values a training
 * cylinder strokes in a fifth of a second - too fast to follow what's happening. 0.15 slows the
 * defaults so a 32 x 100 mm cylinder on a 5/2 valve takes about 1-1.5 s each way (1.1 s out,
 * 1.4 s back; see flowRatings.test.ts).
 * Ratings the user enters - as C or as Nl/min from a data sheet - are used as entered. */
let defaultFlowScale = 0.15;
/** Kinds left at their full rating: a flow meter should barely restrict what it measures. */
const UNSCALED = new Set(['flowMeter']);

/** The scale currently applied to typical ratings. */
export function getDefaultFlowScale(): number {
  return defaultFlowScale;
}

/** For tests that check behaviour at real-world ratings (scale 1). */
export function setDefaultFlowScale(scale: number): void {
  defaultFlowScale = scale;
}

export function defaultFlowRating(type: string): number {
  const typical = DEFAULT_FLOW_RATINGS[type] ?? FALLBACK;
  return UNSCALED.has(type) ? typical : typical * defaultFlowScale;
}

/** Bounds the inspector accepts for a standard nominal flow, Nl/min. */
export const MIN_NOMINAL_FLOW = 1;
export const MAX_NOMINAL_FLOW = 100_000;

/**
 * Standard nominal flow qn (Nl/min) per unit of C (dm³/(s·bar)) for a component with critical
 * ratio `b`: the flow at 6 bar inlet and 5 bar outlet (gauge) - how valve data sheets usually
 * quote flow - by the same ISO 6358 relation the simulation uses: q = C · p1 · φ(p2/p1, b), with
 * p1 = 7 bar and p2 = 6 bar absolute, times 60 for per-minute.
 */
export function nominalFlowPerConductance(b: number): number {
  return 7 * flowFactor(6 / 7, b) * 60;
}

export function nominalFromConductance(c: number, b: number): number {
  return c * nominalFlowPerConductance(b);
}

export function conductanceFromNominal(qn: number, b: number): number {
  return qn / nominalFlowPerConductance(b);
}

/** The C flow mode uses for `comp`: its own C if set, or derived from its own standard nominal
 * flow if that's how it was given, else its kind's default. */
export function flowRatingOf(comp: Component): number {
  if (comp.flowRating !== undefined) return comp.flowRating;
  if (comp.flowNominal !== undefined) {
    return conductanceFromNominal(comp.flowNominal, criticalRatioOf(comp));
  }
  return defaultFlowRating(comp.type);
}

/** The standard nominal flow (Nl/min) `comp` has: its own figure if given that way, else what
 * its C and b come to. */
export function nominalFlowOf(comp: Component): number {
  return comp.flowNominal ?? nominalFromConductance(flowRatingOf(comp), criticalRatioOf(comp));
}

/** The standard nominal flow its kind's typical C and b come to, Nl/min. */
export function defaultNominalFlow(type: string): number {
  return nominalFromConductance(defaultFlowRating(type), defaultCriticalRatio(type));
}

/** Sets (or, with null, clears back to the default) a component's own rating given as a
 * standard nominal flow, Nl/min. Replaces any C it had. */
export function setNominalFlow(comp: Component, value: number | null): void {
  delete comp.flowRating;
  if (value === null || !Number.isFinite(value)) {
    delete comp.flowNominal;
    return;
  }
  comp.flowNominal = Math.max(MIN_NOMINAL_FLOW, Math.min(MAX_NOMINAL_FLOW, value));
}

export function defaultCriticalRatio(type: string): number {
  return DEFAULT_CRITICAL_RATIOS[type] ?? FALLBACK_B;
}

/** The b flow mode uses for `comp`: its own setting if it has one, else its kind's default. */
export function criticalRatioOf(comp: Component): number {
  return comp.flowCriticalRatio ?? defaultCriticalRatio(comp.type);
}

/** Sets (or, with null, clears back to the default) a component's own critical ratio. */
export function setCriticalRatio(comp: Component, value: number | null): void {
  if (value === null || !Number.isFinite(value)) {
    delete comp.flowCriticalRatio;
    return;
  }
  comp.flowCriticalRatio = Math.max(MIN_CRITICAL_RATIO, Math.min(MAX_CRITICAL_RATIO, value));
}

/** Sets (or, with null, clears back to the default) a component's own flow rating. */
export function setFlowRating(comp: Component, value: number | null): void {
  delete comp.flowNominal;
  if (value === null || !Number.isFinite(value)) {
    delete comp.flowRating;
    return;
  }
  comp.flowRating = Math.max(MIN_FLOW_RATING, Math.min(MAX_FLOW_RATING, value));
}

/** Snapshot data plus the component's own flow rating C and critical ratio b, where it has
 * them - what saving, undo and copy/paste store, so they travel with the component without every
 * component having to know about them. */
export function snapshotWithFlowRating(comp: Component): Record<string, unknown> {
  const data = { ...(comp.snapshot() as Record<string, unknown>) };
  if (comp.flowRating !== undefined) data.flowC = comp.flowRating;
  if (comp.flowNominal !== undefined) data.flowQn = comp.flowNominal;
  if (comp.flowCriticalRatio !== undefined) data.flowB = comp.flowCriticalRatio;
  return data;
}

/** The other half of `snapshotWithFlowRating`, after `comp.restore(data)`. */
export function restoreFlowRating(comp: Component, data: Record<string, unknown>): void {
  if (typeof data.flowQn === 'number') setNominalFlow(comp, data.flowQn);
  else setFlowRating(comp, typeof data.flowC === 'number' ? data.flowC : null);
  setCriticalRatio(comp, typeof data.flowB === 'number' ? data.flowB : null);
}
