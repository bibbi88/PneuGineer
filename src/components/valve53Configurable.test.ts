import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from '../sim/engine';
import { setSignal, resetSignals } from '../sim/signals';
import { createSource } from './source';
import { createValve53Configurable } from './valve53Configurable';
import { createValve52Configurable } from './valve52Configurable';
import type { Component } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';

const layer = (): HTMLElement => document.createElement('div');
const viewport: ViewportAdapter = {
  clientToWorld: (x, y) => ({ x, y }),
  applyTransform: () => {},
  getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
  setTransform: () => {},
  setGridVisible: () => {},
};

function add(c: Component, config: Record<string, unknown> = {}): Component {
  appState.addComponent(c);
  c.restore({ ...c.snapshot(), ...config });
  return c;
}
function feed(c: Component, port: string): void {
  const s = createSource(layer(), 0, 0);
  appState.addComponent(s);
  createConnection({ id: s.id, port: 'OUT' }, { id: c.id, port });
}
const step = (n = 2): void => {
  for (let i = 0; i < n; i++) stepSimulation(0.02);
};
const paths = (c: Component): string[] =>
  c.conductivityRule({ isPressurized: () => false }).map((e) => `${e.a}-${e.b}`);

describe('configurable 5/3 valve', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.simulationMode = 'logic';
    appState.setMode(Modes.STOP);
    resetSignals();
    initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
  });
  afterEach(() => {
    appState.simulationMode = 'flow';
  });

  it('has the chosen centre: closed, exhausted or pressurized', () => {
    const v = add(createValve53Configurable(layer(), 0, 0), { centre: 'closed' });
    expect(paths(v)).toEqual([]);
    v.restore({ ...v.snapshot(), centre: 'exhaust' });
    expect(paths(v)).toEqual(['4-5', '2-3']);
    v.restore({ ...v.snapshot(), centre: 'pressure' });
    expect(paths(v)).toEqual(['1-4', '1-2']);
  });

  it('shifts to either side while that end alone is actuated, and centres otherwise', () => {
    const v = add(createValve53Configurable(layer(), 0, 0), {
      left: 'solenoid',
      right: 'solenoid',
      key14: 'Y1',
      key12: 'Y2',
    });
    appState.setMode(Modes.PLAY);
    setSignal('Y1', true);
    step();
    expect(v.snapshot().state).toBe('L');
    setSignal('Y2', true);
    step();
    expect(v.snapshot().state).toBe('C');
    setSignal('Y1', false);
    step();
    expect(v.snapshot().state).toBe('R');
    setSignal('Y2', false);
    step();
    expect(v.snapshot().state).toBe('C');
  });
});

describe('pilot stage', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.simulationMode = 'logic';
    appState.setMode(Modes.STOP);
    resetSignals();
    initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
  });
  afterEach(() => {
    appState.simulationMode = 'flow';
  });

  it('external: the valve shifts only with air at port X, not port 1', () => {
    const v = add(createValve52Configurable(layer(), 0, 0), {
      left: 'solenoid',
      right: 'spring',
      key14: 'Y1',
      pilotSupply: 'external',
    });
    feed(v, '1');
    appState.setMode(Modes.PLAY);
    setSignal('Y1', true);
    step();
    expect(v.snapshot().state).toBe(1); // no pilot air at X

    feed(v, 'X');
    step();
    expect(v.snapshot().state).toBe(0);
  });

  it('applies to an air pilot too: pilot pressure alone is not enough without supply', () => {
    const v = add(createValve52Configurable(layer(), 0, 0), {
      left: 'air',
      right: 'spring',
      pilotSupply: 'internal',
    });
    feed(v, '14');
    appState.setMode(Modes.PLAY);
    step();
    expect(v.snapshot().state).toBe(1);
    feed(v, '1');
    step();
    expect(v.snapshot().state).toBe(0);
  });

  it('shows port X only with an external pilot', () => {
    const v = add(createValve53Configurable(layer(), 0, 0), { pilotSupply: 'internal' });
    const hidden = (): boolean => Boolean(v.ports.X?.el.closest('[style*="display: none"]'));
    expect(hidden()).toBe(true);
    v.restore({ ...v.snapshot(), pilotSupply: 'external' });
    expect(hidden()).toBe(false);
  });
});
