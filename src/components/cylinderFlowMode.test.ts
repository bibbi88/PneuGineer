import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from '../sim/engine';
import { createSource } from './source';
import { createValve52Mono } from './valve52Mono';
import { createCylinderDouble } from './cylinderDouble';
import { createOneWayFlowControlValve } from './oneWayFlowControlValve';
import { serializeProject, loadProject } from '../persistence/project';
import { resetFlowNetwork } from '../sim/flowNetwork';
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

/** Source -> 5/2 valve -> cylinder, optionally with a one-way flow control throttling B's
 * exhaust (meter-out) to `flowPct`. Like a real circuit, the cylinder first sits retracted
 * with B at supply pressure; then the valve is piloted over, so A is driven and B exhausts. */
function circuit(meterOutPct?: number): Component {
  const source = add(createSource(layer(), 0, 0));
  const valve = add(createValve52Mono(layer(), 0, 0));
  const cyl = add(createCylinderDouble(layer(), 0, 0));
  wire(source, 'OUT', valve, '1');
  wire(valve, '4', cyl, 'A');
  if (meterOutPct === undefined) {
    wire(valve, '2', cyl, 'B');
  } else {
    const fc = add(createOneWayFlowControlValve(layer(), 0, 0));
    fc.restore({ ...fc.snapshot(), flowPct: meterOutPct });
    wire(valve, '2', fc, 'IN');
    wire(fc, 'OUT', cyl, 'B');
  }
  for (let i = 0; i < 25; i++) stepSimulation(0.02);
  wire(source, 'OUT', valve, '14');
  return cyl;
}

/** Simulated seconds until the cylinder is fully out (Infinity if not within `limit`). */
function timeToExtend(cyl: Component, limit = 5): number {
  for (let t = 0; t < limit; t += 0.02) {
    stepSimulation(0.02);
    if (pos(cyl) >= 1) return t + 0.02;
  }
  return Infinity;
}

describe('double-acting cylinder in flow mode', () => {
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

  it('extends in a realistic time for a training cylinder', () => {
    const t = timeToExtend(circuit());
    expect(t).toBeGreaterThan(0.08);
    expect(t).toBeLessThan(0.8);
  });

  it('is slowed down by a meter-out flow control on its exhaust', () => {
    const free = timeToExtend(circuit());
    appState.components = [];
    appState.connections = [];
    const slow = timeToExtend(circuit(10));
    expect(slow).toBeGreaterThan(free * 3);
  });

  it('cannot push a load heavier than its force', () => {
    const cyl = circuit();
    // 32 mm bore at 6 bar gives about 480 N.
    cyl.restore({ ...cyl.snapshot(), loadN: 700 });
    expect(timeToExtend(cyl, 2)).toBe(Infinity);
    expect(pos(cyl)).toBe(0);
  });

  it('shows the chamber pressures beside its ports', () => {
    const cyl = circuit();
    timeToExtend(cyl);
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    const labels = [...cyl.el.querySelectorAll<SVGTextElement>('.cylPressure')];
    expect(labels.map((l) => l.textContent)).toEqual(['6.0 bar', '0.0 bar']);
    expect(labels.every((l) => l.style.display !== 'none')).toBe(true);

    cyl.reset();
    expect(labels.every((l) => l.style.display === 'none')).toBe(true);
  });

  it('keeps its stroke, mass and load through save and load', () => {
    const cyl = createCylinderDouble(layer(), 0, 0);
    cyl.restore({ ...cyl.snapshot(), strokeMm: 250, massKg: 4, loadN: -50 });
    const copy = createCylinderDouble(layer(), 0, 0);
    copy.restore(cyl.snapshot());
    expect(copy.snapshot()).toMatchObject({ strokeMm: 250, massKg: 4, loadN: -50 });
  });
});

describe('logic mode is unchanged', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.simulationMode = 'logic';
    initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
  });

  it('moves the cylinder at the logic model’s fixed speed, with no pressure readouts', () => {
    const cyl = circuit();
    expect(pos(cyl)).toBe(0);
    for (let i = 0; i < 10; i++) stepSimulation(0.05);
    // BASE_CYL_SPEED 0.8 of the stroke per second, for half a second.
    expect(pos(cyl)).toBeCloseTo(0.4, 5);
    const labels = [...cyl.el.querySelectorAll<SVGTextElement>('.cylPressure')];
    expect(labels.every((l) => l.style.display === 'none')).toBe(true);
  });
});

describe('simulation mode in the project file', () => {
  afterEach(() => {
    appState.simulationMode = 'logic';
  });

  it('is saved with the project and restored on load', () => {
    appState.components = [];
    appState.connections = [];
    appState.simulationMode = 'flow';
    const file = serializeProject('test');
    expect(file.simulation).toEqual({ mode: 'flow' });

    appState.simulationMode = 'logic';
    loadProject(file, { compLayer: layer() }, viewport);
    expect(appState.simulationMode).toBe('flow');
  });

  it('defaults to logic for a project saved before flow mode existed', () => {
    appState.simulationMode = 'flow';
    const file = serializeProject('test');
    delete file.simulation;
    loadProject(file, { compLayer: layer() }, viewport);
    expect(appState.simulationMode).toBe('logic');
  });
});
