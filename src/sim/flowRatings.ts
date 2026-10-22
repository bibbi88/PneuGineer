/**
 * Flow ratings for flow simulation mode, per ISO 6358: each pneumatic component's sonic
 * conductance C (dm³/(s·bar)) - how much air its paths can pass - and critical pressure ratio b
 * - the downstream/upstream pressure ratio below which that flow is choked (no longer grows as
 * the downstream pressure falls). A component carries its own values once the user sets them in
 * the inspector; until then it has the typical values for its kind below. Figures are typical of
 * the small valves and fittings on a training rig.
 */
import type { Component } from '../core/types';

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

export function defaultFlowRating(type: string): number {
  return DEFAULT_FLOW_RATINGS[type] ?? FALLBACK;
}

/** The C flow mode uses for `comp`: its own setting if it has one, else its kind's default. */
export function flowRatingOf(comp: Component): number {
  return comp.flowRating ?? defaultFlowRating(comp.type);
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
  if (comp.flowCriticalRatio !== undefined) data.flowB = comp.flowCriticalRatio;
  return data;
}

/** The other half of `snapshotWithFlowRating`, after `comp.restore(data)`. */
export function restoreFlowRating(comp: Component, data: Record<string, unknown>): void {
  setFlowRating(comp, typeof data.flowC === 'number' ? data.flowC : null);
  setCriticalRatio(comp, typeof data.flowB === 'number' ? data.flowB : null);
}
