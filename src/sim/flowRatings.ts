/**
 * Flow ratings for flow simulation mode: each pneumatic component's sonic conductance C
 * (ISO 6358, dm³/(s·bar)) - how much air its paths can pass. A component carries its own
 * `flowRating` once the user sets one in the inspector; until then it has the typical value for
 * its kind below. Figures are typical of the small valves and fittings on a training rig.
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

/** Fallback for a pneumatic type missing from the table. */
const FALLBACK = 0.6;
/** Bounds the inspector accepts, dm³/(s·bar). */
export const MIN_FLOW_RATING = 0.01;
export const MAX_FLOW_RATING = 50;

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

/** Sets (or, with null, clears back to the default) a component's own flow rating. */
export function setFlowRating(comp: Component, value: number | null): void {
  if (value === null || !Number.isFinite(value)) {
    delete comp.flowRating;
    return;
  }
  comp.flowRating = Math.max(MIN_FLOW_RATING, Math.min(MAX_FLOW_RATING, value));
}

/** Snapshot data plus the component's own flow rating, if it has one - what saving, undo and
 * copy/paste store, so the rating travels with the component without every component having to
 * know about it. */
export function snapshotWithFlowRating(comp: Component): Record<string, unknown> {
  const data = comp.snapshot() as Record<string, unknown>;
  return comp.flowRating === undefined ? data : { ...data, flowC: comp.flowRating };
}

/** The other half of `snapshotWithFlowRating`, after `comp.restore(data)`. */
export function restoreFlowRating(comp: Component, data: Record<string, unknown>): void {
  setFlowRating(comp, typeof data.flowC === 'number' ? data.flowC : null);
}
