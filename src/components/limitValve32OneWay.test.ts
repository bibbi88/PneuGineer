import { beforeEach, describe, expect, it } from 'vitest';
import { createLimitValve32 } from './limitValve32';
import { createCylinderDouble } from './cylinderDouble';
import { appState } from '../app/AppState';
import { resetSignals, setSignal, setSignalMotion } from '../sim/signals';
import type { Component } from '../core/types';

/** A cylinder carrying sensor a1 over [minPct, maxPct], and a limit valve reading it. */
function valveWith(roller: string, minPct = 95, maxPct = 100): Component {
  const cyl = createCylinderDouble(document.createElement('div'), 0, 0);
  cyl.restore({ ...cyl.snapshot(), sensors: [{ label: 'a1', minPct, maxPct }] });
  appState.addComponent(cyl);
  const v = createLimitValve32(document.createElement('div'), 0, 0);
  v.restore({ ...v.snapshot(), sensorKey: 'a1', roller });
  appState.addComponent(v);
  return v;
}

/** The cylinder reports a1 (`on`) moving `motion`; whether the valve is then actuated (1 to 2 -
 * it's normally closed). */
function report(v: Component, on: boolean, motion: number): boolean {
  setSignal('a1', on);
  setSignalMotion('a1', motion);
  v.recompute?.();
  return v.conductivityRule({ isPressurized: () => false }).some((c) => c.a === '2' && c.b === '1');
}

describe('3/2 limit valve roller', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    resetSignals();
  });

  it('an ordinary roller follows its sensor whichever way the cylinder moves', () => {
    const v = valveWith('roller');
    expect(report(v, true, -1)).toBe(true);
    expect(report(v, true, 0)).toBe(true);
    expect(report(v, false, -1)).toBe(false);
  });

  it('one-way on extend: pressed coming on extending, held stopped and moving back, until off', () => {
    const v = valveWith('oneWayExtend');
    expect(report(v, false, 1)).toBe(false);
    expect(report(v, true, 1)).toBe(true);
    expect(report(v, true, 0)).toBe(true);
    expect(report(v, true, -1)).toBe(true);
    expect(report(v, false, -1)).toBe(false);
  });

  it('one-way on retract, at the end of the stroke: the cam only ever arrives extending, folded', () => {
    const v = valveWith('oneWayRetract');
    expect(report(v, false, 1)).toBe(false);
    expect(report(v, true, 1)).toBe(false);
    expect(report(v, true, 0)).toBe(false);
    expect(report(v, true, -1)).toBe(false);
    expect(report(v, false, -1)).toBe(false);
  });

  it('one-way mid-stroke: pressed passing the trip way, folded passing the other way', () => {
    const v = valveWith('oneWayRetract', 40, 50);
    expect(report(v, false, -1)).toBe(false);
    expect(report(v, true, -1)).toBe(true);
    expect(report(v, true, -1)).toBe(true);
    expect(report(v, false, -1)).toBe(false);
    expect(report(v, true, 1)).toBe(false);
    expect(report(v, true, 1)).toBe(false);
    expect(report(v, false, 1)).toBe(false);
  });

  it('a run starting with the cam on it: pressed if it can only have come the trip way', () => {
    // a1 at the end of the stroke, the cylinder starting extended, then retracting at once.
    expect(report(valveWith('oneWayExtend'), true, -1)).toBe(true);
    appState.components = [];
    resetSignals();
    expect(report(valveWith('oneWayRetract'), true, -1)).toBe(false);
    appState.components = [];
    resetSignals();
    // Mid-stroke, there's no telling: not pressed.
    expect(report(valveWith('oneWayExtend', 40, 50), true, 0)).toBe(false);
  });

  it('stays as it is until its cylinder has reported, then starts over after a reset', () => {
    const v = valveWith('oneWayExtend');
    v.recompute?.();
    expect(v.conductivityRule({ isPressurized: () => false })).toEqual([{ a: '2', b: '3' }]);
    expect(report(v, true, 1)).toBe(true);
    v.reset();
    resetSignals();
    expect(report(v, false, 0)).toBe(false);
  });

  it('saves the roller kind, and an ordinary roller saves as before', () => {
    expect(valveWith('oneWayRetract').snapshot().roller).toBe('oneWayRetract');
    expect(valveWith('roller').snapshot()).not.toHaveProperty('roller');
  });
});
