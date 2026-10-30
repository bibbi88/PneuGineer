import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from '../sim/engine';
import { setSignal, resetSignals } from '../sim/signals';
import { createSource } from './source';
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

function valve(config: Record<string, unknown>, supplied = true): Component {
  const v = createValve52Configurable(layer(), 0, 0);
  appState.addComponent(v);
  v.restore({ ...v.snapshot(), ...config });
  if (supplied) {
    const s = createSource(layer(), 0, 0);
    appState.addComponent(s);
    createConnection({ id: s.id, port: 'OUT' }, { id: v.id, port: '1' });
  }
  return v;
}

const state = (v: Component): unknown => v.snapshot().state;
const step = (n = 2): void => {
  for (let i = 0; i < n; i++) stepSimulation(0.02);
};

describe('configurable 5/2 valve', () => {
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

  it('solenoid against a spring: 1->4 while energized, back to 1->2 when not', () => {
    const v = valve({ left: 'solenoid', right: 'spring', key14: 'Y1' });
    expect(state(v)).toBe(1);
    appState.setMode(Modes.PLAY);
    setSignal('Y1', true);
    step();
    expect(state(v)).toBe(0);
    setSignal('Y1', false);
    step();
    expect(state(v)).toBe(1);
  });

  it('pilot operated: the solenoid only shifts it with pressure at port 1', () => {
    const dry = valve(
      { left: 'solenoid', right: 'spring', key14: 'Y1', pilotOperated: true },
      false,
    );
    appState.setMode(Modes.PLAY);
    setSignal('Y1', true);
    step();
    expect(state(dry)).toBe(1);

    appState.components = [];
    appState.connections = [];
    appState.setMode(Modes.STOP);
    const fed = valve({ left: 'solenoid', right: 'spring', key14: 'Y1', pilotOperated: true });
    appState.setMode(Modes.PLAY);
    step();
    expect(state(fed)).toBe(0);
  });

  it('roller on both ends: bistable, holds, and starts where set', () => {
    const v = valve({
      left: 'roller',
      right: 'roller',
      sensor14: 'A1',
      sensor12: 'A0',
      startPos: 0,
    });
    expect(state(v)).toBe(0); // set to start in 1->4 while stopped
    appState.setMode(Modes.PLAY);
    setSignal('A0', true);
    step();
    expect(state(v)).toBe(1);
    setSignal('A0', false);
    step();
    expect(state(v)).toBe(1); // stays put
    setSignal('A1', true);
    step();
    expect(state(v)).toBe(0);
    v.reset();
    expect(state(v)).toBe(0); // back to its start position
  });

  it('push button: shifted while pressed', () => {
    const v = valve({ left: 'button', right: 'spring' });
    appState.setMode(Modes.PLAY);
    const svg = v.el.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 100 }) as DOMRect;
    svg.dispatchEvent(new MouseEvent('mousedown', { clientX: 20, bubbles: true }));
    step();
    expect(state(v)).toBe(0);
    window.dispatchEvent(new MouseEvent('mouseup'));
    step();
    expect(state(v)).toBe(1);
  });

  it('hides the pilot port of an end with no air pilot', () => {
    const v = valve({ left: 'solenoid', right: 'air', key14: 'Y1' });
    const hidden = (port: string): boolean =>
      Boolean(v.ports[port]?.el.closest('[style*="display: none"]'));
    expect(hidden('14')).toBe(true);
    expect(hidden('12')).toBe(false);
  });
});
