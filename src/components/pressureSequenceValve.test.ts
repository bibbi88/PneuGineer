import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from '../sim/engine';
import { portKey } from '../sim/pressure';
import { createSource } from './source';
import { createPressureReducingValve } from './pressureReducingValve';
import { componentRegistry } from './registry';
import { createPressureSequenceValve, PRESSURE_SEQUENCE_VALVE_TYPE } from './pressureSequenceValve';
import type { Component, SimStepContext } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';

const layer = (): HTMLElement => document.createElement('div');
const OPEN = [{ a: '2', b: '1' }];
const CLOSED = [{ a: '2', b: '3' }];
const noPressure = { isPressurized: () => false };

function ctx(supply: boolean, p12: number): SimStepContext {
  return {
    isPressurized: (p: string) => (p === '1' ? supply : p12 > 0),
    pressureAt: (p: string) => (p === '12' ? p12 : supply ? 6 : 0),
  } as unknown as SimStepContext;
}

describe('pressure sequence valve', () => {
  it('is closed (2 vented to 3) at rest', () => {
    const valve = createPressureSequenceValve(layer(), 0, 0);
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('switches once the pressure at 12 reaches the set pressure, and not before', () => {
    const valve = createPressureSequenceValve(layer(), 0, 0); // 3.0 bar by default
    valve.step?.(0.1, ctx(true, 2.9));
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
    valve.step?.(0.1, ctx(true, 3.0));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('drops back as soon as the pressure at 12 falls below it', () => {
    const valve = createPressureSequenceValve(layer(), 0, 0);
    valve.step?.(0.1, ctx(true, 6));
    valve.step?.(0.1, ctx(true, 1));
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('cannot switch without supply at 1 - that is where its pilot air comes from', () => {
    const valve = createPressureSequenceValve(layer(), 0, 0);
    valve.step?.(0.1, ctx(false, 6));
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('keeps its set pressure through save and load, limited to the supply pressure', () => {
    const valve = createPressureSequenceValve(layer(), 0, 0);
    valve.restore({ ...valve.snapshot(), setPressure: 4.5 });
    expect(valve.snapshot().setPressure).toBe(4.5);
    valve.restore({ ...valve.snapshot(), setPressure: 99 });
    expect(valve.snapshot().setPressure).toBe(6);
  });

  it('reset() returns it to rest', () => {
    const valve = createPressureSequenceValve(layer(), 0, 0);
    valve.step?.(0.1, ctx(true, 6));
    valve.reset();
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('is in the library under its English name', () => {
    const entry = componentRegistry.get(PRESSURE_SEQUENCE_VALVE_TYPE);
    expect(entry?.placeable).toBe(true);
    expect(entry?.label).toBe('Pressure sequence valve');
  });
});

describe('pressure sequence valve in a circuit', () => {
  const viewport: ViewportAdapter = {
    clientToWorld: (x, y) => ({ x, y }),
    applyTransform: () => {},
    getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
    setTransform: () => {},
    setGridVisible: () => {},
  };

  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
  });

  function add<T extends Component>(c: T): T {
    appState.addComponent(c);
    return c;
  }

  /** Supply at 1; port 12 fed through a pressure reducing valve set to `signalBar`. Returns
   * whether 2 is pressurized after a couple of frames. */
  function run(signalBar: number): boolean {
    const source = add(createSource(layer(), 0, 0));
    const reducer = add(createPressureReducingValve(layer(), 0, 0));
    reducer.restore({ ...reducer.snapshot(), outletPressure: signalBar });
    const valve = add(createPressureSequenceValve(layer(), 0, 0));
    createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '1' });
    createConnection({ id: source.id, port: 'OUT' }, { id: reducer.id, port: 'IN' });
    createConnection({ id: reducer.id, port: 'OUT' }, { id: valve.id, port: '12' });
    stepSimulation(0.05);
    return stepSimulation(0.05).pressurized.has(portKey(valve.id, '2'));
  }

  it('stays off while the signal at 12 is below the set pressure', () => {
    expect(run(2)).toBe(false);
  });

  it('passes supply to 2 once the signal at 12 reaches it', () => {
    expect(run(4)).toBe(true);
  });
});
