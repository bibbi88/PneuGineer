import { describe, expect, it } from 'vitest';
import {
  atRest,
  fromGaugeBar,
  isoMassFlow,
  P_ATM,
  stepCylinder,
  toGaugeBar,
  type CylinderSpec,
  type PortFeed,
} from './flowModel';

const area = (dMm: number): number => Math.PI * (dMm / 2000) ** 2;
/** A 32/12 mm training cylinder with a 100 mm stroke. */
const SPEC: CylinderSpec = {
  areaA: area(32),
  areaB: area(32) - area(12),
  stroke: 0.1,
  mass: 1,
  load: 0,
  deadVolume: area(32) * 0.01 + 12.5e-6,
  friction: 20,
  damping: 50,
};
const SUPPLY: PortFeed = { kind: 'supply', pressure: fromGaugeBar(6), conductance: 0.4 };
const EXHAUST: PortFeed = { kind: 'exhaust', conductance: 0.4 };

/** Extends from fully retracted with B starting at supply pressure, as it is in a real circuit
 * (the valve held it retracted). Returns the stroke time, or Infinity if it never gets there. */
function strokeTime(spec: CylinderSpec, feedA: PortFeed, feedB: PortFeed, limit = 10): number {
  const s = atRest(0);
  s.pB = fromGaugeBar(6);
  for (let t = 0; t < limit; t += 0.01) {
    stepCylinder(s, spec, feedA, feedB, 0.01);
    if (s.x >= spec.stroke) return t + 0.01;
  }
  return Infinity;
}

describe('isoMassFlow', () => {
  it('is zero without a pressure difference or a path', () => {
    expect(isoMassFlow(5e5, 5e5, 0.4)).toBe(0);
    expect(isoMassFlow(7e5, 1e5, 0)).toBe(0);
  });

  it('runs the other way when the pressures are swapped', () => {
    expect(isoMassFlow(2e5, 6e5, 0.4)).toBeCloseTo(-isoMassFlow(6e5, 2e5, 0.4), 12);
  });

  it('is choked below the critical ratio: the downstream pressure no longer matters', () => {
    expect(isoMassFlow(7e5, 1e5, 0.4)).toBeCloseTo(isoMassFlow(7e5, 2e5, 0.4), 12);
  });

  it('falls off towards zero as the downstream pressure approaches the upstream one', () => {
    const choked = isoMassFlow(7e5, 1e5, 0.4);
    const near = isoMassFlow(7e5, 6.9e5, 0.4);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(choked * 0.3);
  });

  it('scales with conductance', () => {
    expect(isoMassFlow(7e5, 1e5, 0.2)).toBeCloseTo(isoMassFlow(7e5, 1e5, 0.4) / 2, 12);
  });
});

describe('stepCylinder', () => {
  it('extends a training cylinder in a fraction of a second', () => {
    const t = strokeTime(SPEC, SUPPLY, EXHAUST);
    expect(t).toBeGreaterThan(0.1);
    expect(t).toBeLessThan(0.6);
  });

  it('ends with the driven chamber at supply pressure and the other at atmosphere', () => {
    const s = atRest(0);
    for (let i = 0; i < 300; i++) stepCylinder(s, SPEC, SUPPLY, EXHAUST, 0.01);
    expect(s.x).toBe(SPEC.stroke);
    expect(toGaugeBar(s.pA)).toBeCloseTo(6, 2);
    expect(toGaugeBar(s.pB)).toBeCloseTo(0, 2);
  });

  it('is slowed by throttling the exhaust (meter-out), building back-pressure in B', () => {
    const free = strokeTime(SPEC, SUPPLY, EXHAUST);
    const throttled = strokeTime(SPEC, SUPPLY, { kind: 'exhaust', conductance: 0.04 });
    expect(throttled).toBeGreaterThan(free * 4);

    const s = atRest(0);
    s.pB = fromGaugeBar(6);
    for (let i = 0; i < 40; i++) {
      stepCylinder(s, SPEC, SUPPLY, { kind: 'exhaust', conductance: 0.04 }, 0.01);
    }
    // Mid-stroke, B is held up above A - the smaller rod-side area needs more pressure to
    // balance the same force.
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(SPEC.stroke);
    expect(s.pB).toBeGreaterThan(s.pA);
  });

  it('is slowed by throttling the supply (meter-in) too', () => {
    const free = strokeTime(SPEC, SUPPLY, EXHAUST);
    const throttled = strokeTime(SPEC, { ...SUPPLY, conductance: 0.04 }, EXHAUST);
    expect(throttled).toBeGreaterThan(free * 1.5);
  });

  it('is slowed by a load, and stalls under one heavier than it can push', () => {
    // 32 mm at 6 bar pushes about 480 N.
    const free = strokeTime(SPEC, SUPPLY, EXHAUST);
    expect(strokeTime({ ...SPEC, load: 300 }, SUPPLY, EXHAUST)).toBeGreaterThan(free);
    expect(strokeTime({ ...SPEC, load: 600 }, SUPPLY, EXHAUST, 3)).toBe(Infinity);
  });

  it('holds still when its exhaust is shut off', () => {
    const s = atRest(0);
    s.pB = fromGaugeBar(6);
    for (let i = 0; i < 100; i++) stepCylinder(s, SPEC, SUPPLY, { kind: 'closed' }, 0.01);
    // It creeps only as far as compressing the trapped air allows, and stops there.
    const x = s.x;
    for (let i = 0; i < 100; i++) stepCylinder(s, SPEC, SUPPLY, { kind: 'closed' }, 0.01);
    expect(s.x).toBeLessThan(SPEC.stroke);
    expect(s.x).toBeCloseTo(x, 4);
  });

  it('stays at rest with no air at all', () => {
    const s = atRest(0.05);
    stepCylinder(s, SPEC, { kind: 'closed' }, { kind: 'closed' }, 0.5);
    expect(s).toEqual({ pA: P_ATM, pB: P_ATM, x: 0.05, v: 0 });
  });
});
