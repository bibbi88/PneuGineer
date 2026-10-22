import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from '../sim/engine';
import { portKey } from '../sim/pressure';
import { createSource } from './source';
import { componentRegistry } from './registry';
import {
  createTimeDelayValve,
  TIME_DELAY_VALVE_NO_TYPE,
  TIME_DELAY_VALVE_TYPE,
} from './timeDelayValve';
import type { Component, SimStepContext } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';

const layer = (): HTMLElement => document.createElement('div');
const OPEN = [{ a: '2', b: '1' }];
const CLOSED = [{ a: '2', b: '3' }];
const noPressure = { isPressurized: () => false };

function pilot(on: boolean): SimStepContext {
  return { isPressurized: () => on } as unknown as SimStepContext;
}

describe('time delay valve, normally open', () => {
  it('passes 1 to 2 at rest, and shuts off once 12 has been held for the delay', () => {
    const valve = createTimeDelayValve(layer(), 0, 0, 'NO');
    expect(valve.type).toBe(TIME_DELAY_VALVE_NO_TYPE);
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);

    for (let i = 0; i < 5; i++) valve.step?.(0.1, pilot(true));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);

    for (let i = 0; i < 6; i++) valve.step?.(0.1, pilot(true));
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('opens again the moment 12 is released, ready for the next pulse', () => {
    const valve = createTimeDelayValve(layer(), 0, 0, 'NO');
    for (let i = 0; i < 15; i++) valve.step?.(0.1, pilot(true));
    valve.step?.(0.1, pilot(false));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('stays normally open through save and load, whatever the data says', () => {
    const valve = createTimeDelayValve(layer(), 0, 0, 'NO');
    valve.restore({ ...valve.snapshot(), normallyOpen: false, delaySec: 2.5 });
    expect(valve.snapshot()).toMatchObject({ normallyOpen: true, delaySec: 2.5 });
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('leaves the plain time delay valve normally closed by default', () => {
    const valve = createTimeDelayValve(layer(), 0, 0);
    expect(valve.type).toBe(TIME_DELAY_VALVE_TYPE);
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('is in the library, findable as a pulse valve', () => {
    const entry = componentRegistry.get(TIME_DELAY_VALVE_NO_TYPE);
    expect(entry?.placeable).toBe(true);
    expect(entry?.label).toBe('Time delay valve, normally open');
    expect(entry?.keywords).toContain('pulse valve');
  });

  it('draws the ISO symbol: throttle and check valve, reservoir, in a dash-dot frame', () => {
    const valve = createTimeDelayValve(layer(), 0, 0, 'NO');
    const svg = valve.el.querySelector('svg') as SVGSVGElement;
    expect(svg.querySelector('rect[stroke-dasharray]')).not.toBeNull();
    expect(svg.querySelector('rect[rx]')).not.toBeNull(); // the reservoir
    expect(svg.querySelector('circle:not([data-port])')).not.toBeNull(); // check valve ball
  });
});

describe('time delay valve, normally open, in a circuit', () => {
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

  it('turns a held signal into a pulse as long as the delay', () => {
    // The pulse-valve connection: the same signal feeds both supply port 1 and pilot 12.
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createTimeDelayValve(layer(), 0, 0, 'NO'));
    createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '1' });
    createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '12' });
    const out = portKey(valve.id, '2');

    expect(stepSimulation(0.1).pressurized.has(out)).toBe(true);
    let graph = stepSimulation(0.5);
    expect(graph.pressurized.has(out)).toBe(true);
    for (let i = 0; i < 6; i++) graph = stepSimulation(0.1);
    // 1.2 s in - past the 1 s delay: the output has gone off though the signal is still on.
    expect(graph.pressurized.has(out)).toBe(false);
  });
});
