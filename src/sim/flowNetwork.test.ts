import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from './engine';
import { portKey } from './pressure';
import { flowPressureAt, resetFlowNetwork } from './flowNetwork';
import { createSource } from '../components/source';
import { createValve52Mono } from '../components/valve52Mono';
import { createCylinderDouble } from '../components/cylinderDouble';
import { createPressureSequenceValve } from '../components/pressureSequenceValve';
import { createPressureReducingValve } from '../components/pressureReducingValve';
import { createOneWayFlowControlValve } from '../components/oneWayFlowControlValve';
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
function pos(c: Component): number {
  return (c.snapshot() as { pos: number }).pos;
}
function bar(c: Component, port: string): number {
  return flowPressureAt(portKey(c.id, port)) ?? NaN;
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

/** Source -> 5/2 valve -> cylinder, settled retracted (B at supply), then switched to extend. */
function cylinderCircuit(): { source: Component; valve: Component; cyl: Component } {
  const source = add(createSource(layer(), 0, 0));
  const valve = add(createValve52Mono(layer(), 0, 0));
  const cyl = add(createCylinderDouble(layer(), 0, 0));
  wire(source, 'OUT', valve, '1');
  wire(valve, '4', cyl, 'A');
  wire(valve, '2', cyl, 'B');
  for (let i = 0; i < 25; i++) stepSimulation(0.02);
  return { source, valve, cyl };
}

describe('flow network', () => {
  it('holds a supply line at supply pressure', () => {
    const { source, valve } = cylinderCircuit();
    expect(bar(source, 'OUT')).toBeCloseTo(6, 5);
    expect(bar(valve, '1')).toBeCloseTo(6, 5);
  });

  it('fills the line to a retracted cylinder’s rod side, and leaves the other empty', () => {
    const { cyl } = cylinderCircuit();
    expect(bar(cyl, 'B')).toBeGreaterThan(5.9);
    expect(bar(cyl, 'A')).toBeLessThan(0.1);
  });

  it('shows a driving line below supply pressure while the piston moves, full once it stops', () => {
    const { source, valve, cyl } = cylinderCircuit();
    wire(source, 'OUT', valve, '14');
    let lowest = Infinity;
    for (let i = 0; i < 100 && pos(cyl) < 1; i++) {
      stepSimulation(0.01);
      if (pos(cyl) > 0.2 && pos(cyl) < 0.8) lowest = Math.min(lowest, bar(cyl, 'A'));
    }
    expect(pos(cyl)).toBe(1);
    // While air is streaming in, the restrictions on the way drop the pressure.
    expect(lowest).toBeLessThan(5.5);
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    expect(bar(cyl, 'A')).toBeGreaterThan(5.9);
    expect(bar(cyl, 'B')).toBeLessThan(0.1);
  });

  it('limits a line fed through a pressure reducing valve to its setting', () => {
    const source = add(createSource(layer(), 0, 0));
    const reducer = add(createPressureReducingValve(layer(), 0, 0));
    reducer.restore({ ...reducer.snapshot(), outletPressure: 2.5 });
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    wire(source, 'OUT', reducer, 'IN');
    wire(reducer, 'OUT', cyl, 'A');
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    expect(bar(cyl, 'A')).toBeGreaterThan(2.2);
    expect(bar(cyl, 'A')).toBeLessThanOrEqual(2.55);
  });

  it('lets a pressure sequence valve on a meter-in line switch only at the end of stroke', () => {
    // The classic arrangement: the supply to A is throttled (meter-in), so while the piston
    // moves the line to A stays well below supply pressure, and only rises - to the sequence
    // valve's setting - once the piston stops at the end of its stroke.
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createValve52Mono(layer(), 0, 0));
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    const meterIn = add(createOneWayFlowControlValve(layer(), 0, 0));
    meterIn.restore({ ...meterIn.snapshot(), flowPct: 20 });
    const seq = add(createPressureSequenceValve(layer(), 0, 0));
    seq.restore({ ...seq.snapshot(), setPressure: 5 });
    wire(source, 'OUT', valve, '1');
    // Throttled valve -> cylinder (OUT -> IN), free on the way back.
    wire(valve, '4', meterIn, 'OUT');
    wire(meterIn, 'IN', cyl, 'A');
    wire(valve, '2', cyl, 'B');
    wire(source, 'OUT', seq, '1');
    wire(cyl, 'A', seq, '12');
    for (let i = 0; i < 25; i++) stepSimulation(0.02);
    wire(source, 'OUT', valve, '14');

    let switchedAt = -1;
    for (let i = 0; i < 500; i++) {
      const graph = stepSimulation(0.01);
      if (graph.pressurized.has(portKey(seq.id, '2'))) {
        switchedAt = pos(cyl);
        break;
      }
    }
    expect(switchedAt).toBe(1);
  });
});
