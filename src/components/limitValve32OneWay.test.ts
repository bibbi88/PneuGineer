import { beforeEach, describe, expect, it } from 'vitest';
import { createLimitValve32 } from './limitValve32';
import { resetSignals, setSignal, setSignalMotion } from '../sim/signals';
import type { Component } from '../core/types';

function valveWith(roller: string): Component {
  const v = createLimitValve32(document.createElement('div'), 0, 0);
  v.restore({ ...v.snapshot(), sensorKey: 'a1', roller });
  return v;
}

/** Whether 1 is through to 2 (the valve actuated - it's normally closed). */
function open(v: Component): boolean {
  v.recompute?.();
  return v.conductivityRule({ isPressurized: () => false }).some((c) => c.a === '2' && c.b === '1');
}

describe('3/2 limit valve roller', () => {
  beforeEach(() => resetSignals());

  it('an ordinary roller follows its sensor whichever way the cylinder moves', () => {
    const v = valveWith('roller');
    setSignal('a1', true);
    setSignalMotion('a1', -1);
    expect(open(v)).toBe(true);
    setSignalMotion('a1', 0);
    expect(open(v)).toBe(true);
  });

  it('a one-way roller trips on extend, holds a short pulse, then lets go at rest', () => {
    const v = valveWith('oneWayExtend');
    setSignal('a1', true);
    setSignalMotion('a1', 1);
    expect(open(v)).toBe(true);
    // The cylinder stops on it: still on for the pulse...
    setSignalMotion('a1', 0);
    v.step?.(0.1, {} as never);
    expect(open(v)).toBe(true);
    // ...then released, though the cam still rests on it.
    v.step?.(0.5, {} as never);
    expect(open(v)).toBe(false);
  });

  it('a one-way roller set for extend folds away when the cylinder retracts past it', () => {
    const v = valveWith('oneWayExtend');
    setSignal('a1', true);
    setSignalMotion('a1', -1);
    expect(open(v)).toBe(false);
  });

  it('the other one-way roller trips on retract only', () => {
    const v = valveWith('oneWayRetract');
    setSignal('a1', true);
    setSignalMotion('a1', 1);
    expect(open(v)).toBe(false);
    setSignalMotion('a1', -1);
    expect(open(v)).toBe(true);
    setSignal('a1', false);
    expect(open(v)).toBe(false);
  });

  it('saves the roller kind, and an ordinary roller saves as before', () => {
    expect(valveWith('oneWayRetract').snapshot().roller).toBe('oneWayRetract');
    expect(valveWith('roller').snapshot()).not.toHaveProperty('roller');
  });
});
