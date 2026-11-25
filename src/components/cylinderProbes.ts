/**
 * What a cylinder measured in its last step, for the diagram recorder (sim/recorder.ts): rod
 * position and speed, the chamber pressures, the force on the rod, the air it takes in and the
 * power that reaches the load. Pressures, force and air are only known in Flow simulation.
 */
import type { Probe } from '../core/types';

export interface CylinderMeasure {
  /** Rod position, mm from fully retracted. */
  xMm: number;
  /** Rod speed, m/s (positive extending). */
  v: number;
  /** Gauge pressure in each chamber, bar (NaN where not known). */
  pA: number;
  pB?: number;
  /** Force on the rod from the air, N (after the seals' losses). */
  force: number;
  /** Free air taken in, Nl/min (NaN in Logic simulation). */
  airNlpm: number;
  /** Load force, N (positive opposing extension). */
  load: number;
}

/** A figure that's zero for all practical purposes (a chamber that has stopped filling) as 0, so
 * the diagrams' tables don't show 1e-11. */
export function cleanZero(v: number, below = 1e-3): number {
  return Math.abs(v) < below ? 0 : v;
}

export function cylinderProbes(m: CylinderMeasure): Probe[] {
  const probes: Probe[] = [
    { key: 'x', label: 'Position x', unit: 'mm', value: m.xMm },
    { key: 'v', label: 'Speed v', unit: 'm/s', value: cleanZero(m.v, 1e-6) },
    { key: 'pA', label: 'Pressure, chamber A', unit: 'bar', value: m.pA },
  ];
  if (m.pB !== undefined) {
    probes.push({ key: 'pB', label: 'Pressure, chamber B', unit: 'bar', value: m.pB });
  }
  probes.push(
    { key: 'F', label: 'Force on the rod F', unit: 'N', value: m.force },
    { key: 'air', label: 'Air used', unit: 'Nl/min', value: cleanZero(m.airNlpm) },
    { key: 'pAir', label: 'Air power in (F·v)', unit: 'W', value: m.force * m.v },
    { key: 'pLoad', label: 'Power to the load', unit: 'W', value: m.load * m.v },
  );
  return probes;
}
