import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from '../sim/engine';
import { resetFlowNetwork } from '../sim/flowNetwork';
import { createSource } from './source';
import { createValve52Mono } from './valve52Mono';
import { createCylinderDouble } from './cylinderDouble';
import { createFlowMeter, FLOW_METER_TYPE } from './flowMeter';
import { componentRegistry } from './registry';
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

function add<T extends Component>(c: T): T {
  appState.addComponent(c);
  return c;
}
function wire(a: Component, ap: string, b: Component, bp: string): void {
  createConnection({ id: a.id, port: ap }, { id: b.id, port: bp });
}
const rate = (m: Component): string => m.el.querySelector('.flowMeterRate')?.textContent ?? '';
const total = (m: Component): number =>
  parseFloat((m.el.querySelector('.flowMeterTotal')?.textContent ?? '').replace('Σ', ''));
const shown = (m: Component): boolean =>
  (m.el.querySelector('.flowMeterReading') as HTMLElement).style.display !== 'none';

/** Source -> flow meter -> 5/2 valve -> 32/12 x 100 mm cylinder. `reversed` fits the meter the
 * other way round (OUT towards the source). */
function circuit(reversed = false): { meter: Component; source: Component; valve: Component } {
  const source = add(createSource(layer(), 0, 0));
  const meter = add(createFlowMeter(layer(), 0, 0));
  const valve = add(createValve52Mono(layer(), 0, 0));
  const cyl = add(createCylinderDouble(layer(), 0, 0));
  wire(source, 'OUT', meter, reversed ? 'OUT' : 'IN');
  wire(meter, reversed ? 'IN' : 'OUT', valve, '1');
  wire(valve, '4', cyl, 'A');
  wire(valve, '2', cyl, 'B');
  return { meter, source, valve };
}

beforeEach(() => {
  appState.components = [];
  appState.connections = [];
  appState.simulationMode = 'flow';
  resetFlowNetwork();
  initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
});
afterEach(() => {
  appState.simulationMode = 'logic';
});

describe('flow meter', () => {
  it('reads the air streaming through it while a cylinder strokes, and zero once it stops', () => {
    const { meter, source, valve } = circuit();
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    expect(rate(meter)).toBe('0 l/min');

    wire(source, 'OUT', valve, '14');
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      stepSimulation(0.01);
      peak = Math.max(peak, parseFloat(rate(meter)));
    }
    expect(peak).toBeGreaterThan(50);
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    expect(rate(meter)).toBe('0 l/min');
  });

  it('totals about the air one stroke of the cylinder takes', () => {
    const { meter, source, valve } = circuit();
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    const afterFirstFill = total(meter);
    wire(source, 'OUT', valve, '14');
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    // 32 mm x 100 mm is 0.08 l of cylinder; filled to 6 bar that is about 0.5 l of free air,
    // plus the dead volume and a little line.
    const stroke = total(meter) - afterFirstFill;
    expect(stroke).toBeGreaterThan(0.4);
    expect(stroke).toBeLessThan(0.9);
  });

  it('reads negative when fitted the other way round', () => {
    const { meter, source, valve } = circuit(true);
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    wire(source, 'OUT', valve, '14');
    let lowest = 0;
    for (let i = 0; i < 30; i++) {
      stepSimulation(0.01);
      lowest = Math.min(lowest, parseFloat(rate(meter).replace('−', '-')));
    }
    expect(lowest).toBeLessThan(-50);
  });

  it('starts again from zero when the simulation is reset', () => {
    const { meter } = circuit();
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    expect(total(meter)).toBeGreaterThan(0);
    meter.reset();
    expect(shown(meter)).toBe(false);
    stepSimulation(0.02);
    expect(total(meter)).toBeLessThan(0.01);
  });

  it('shows nothing in logic mode', () => {
    appState.simulationMode = 'logic';
    const { meter } = circuit();
    stepSimulation(0.02);
    expect(shown(meter)).toBe(false);
  });

  it('is in the library', () => {
    expect(componentRegistry.get(FLOW_METER_TYPE)?.label).toBe('Flow meter');
  });
});
