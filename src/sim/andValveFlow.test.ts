import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from './engine';
import { portKey } from './pressure';
import { flowPressureAt, resetFlowNetwork } from './flowNetwork';
import { createSource } from '../components/source';
import { createPushButton32 } from '../components/pushButton32';
import { createAndValve } from '../components/andValve';
import { createOrValve } from '../components/orValve';
import { createCylinderSingle } from '../components/cylinderSingle';
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
function bar(c: Component, port: string): number {
  return flowPressureAt(portKey(c.id, port)) ?? NaN;
}
function pos(c: Component): number {
  return (c.snapshot() as { pos: number }).pos;
}
function press(button: Component, down: boolean): void {
  button.restore({ ...button.snapshot(), active: down });
}
function run(seconds: number): void {
  for (let t = 0; t < seconds; t += 0.02) stepSimulation(0.02);
}

/** Two push buttons, each from its own source, into the inputs of a logic valve whose output
 * drives a single-acting cylinder. */
function circuit(create: typeof createAndValve): {
  b1: Component;
  b2: Component;
  logic: Component;
  cyl: Component;
} {
  const s1 = add(createSource(layer(), 0, 0));
  const s2 = add(createSource(layer(), 0, 0));
  const b1 = add(createPushButton32(layer(), 0, 0));
  const b2 = add(createPushButton32(layer(), 0, 0));
  const logic = add(create(layer(), 0, 0));
  const cyl = add(createCylinderSingle(layer(), 0, 0));
  wire(s1, 'OUT', b1, '1');
  wire(s2, 'OUT', b2, '1');
  wire(b1, '2', logic, 'A');
  wire(b2, '2', logic, 'B');
  wire(logic, 'OUT', cyl, 'A');
  return { b1, b2, logic, cyl };
}

describe('logic valves in flow mode', () => {
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

  it('AND: passes air only while both signals are on, and vents when either goes', () => {
    const { b1, b2, logic, cyl } = circuit(createAndValve);
    press(b1, true);
    run(1);
    expect(bar(logic, 'OUT')).toBeLessThan(0.5);

    press(b2, true);
    run(3);
    expect(bar(logic, 'OUT')).toBeGreaterThan(5);
    expect(pos(cyl)).toBe(1);

    press(b2, false);
    run(5);
    expect(bar(logic, 'OUT')).toBeLessThan(0.5);
    expect(pos(cyl)).toBe(0);
    expect(bar(logic, 'B')).toBeLessThan(0.5);
    expect(bar(logic, 'A')).toBeGreaterThan(5);

    press(b2, true);
    run(3);
    expect(bar(logic, 'OUT')).toBeGreaterThan(5);
    press(b1, false);
    run(5);
    expect(bar(logic, 'OUT')).toBeLessThan(0.5);
  });

  it('OR: passes air on either signal, and vents once both have gone', () => {
    const { b1, b2, logic } = circuit(createOrValve);
    press(b1, true);
    run(3);
    expect(bar(logic, 'OUT')).toBeGreaterThan(5);
    press(b1, false);
    run(5);
    expect(bar(logic, 'OUT')).toBeLessThan(0.5);
    press(b2, true);
    run(3);
    expect(bar(logic, 'OUT')).toBeGreaterThan(5);
    expect(bar(logic, 'A')).toBeLessThan(0.5); // the shuttle keeps B's air out of A's line
    press(b2, false);
    run(5);
    expect(bar(logic, 'OUT')).toBeLessThan(0.5);
  });
});
