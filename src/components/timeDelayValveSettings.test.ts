import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from '../sim/engine';
import { portKey } from '../sim/pressure';
import { createSource } from './source';
import { componentRegistry } from './registry';
import { createTimeDelayValve, TIME_DELAY_VALVE_TYPE } from './timeDelayValve';
import type { Component, SimStepContext } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';

const layer = (): HTMLElement => document.createElement('div');
const OPEN = [{ a: '2', b: '1' }];
const CLOSED = [{ a: '2', b: '3' }];
const noPressure = { isPressurized: () => false };

/** A time delay valve with the given settings ticked. */
function timeDelay(settings: { normallyOpen?: boolean; offDelay?: boolean } = {}): Component {
  const valve = createTimeDelayValve(layer(), 0, 0);
  valve.restore({ ...valve.snapshot(), ...settings });
  return valve;
}

function pilot(on: boolean): SimStepContext {
  return { isPressurized: () => on } as unknown as SimStepContext;
}

describe('time delay valve, normally open', () => {
  it('passes 1 to 2 at rest, and shuts off once 12 has been held for the delay', () => {
    const valve = timeDelay({ normallyOpen: true });
    expect(valve.snapshot()).toMatchObject({ normallyOpen: true, offDelay: false });
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);

    for (let i = 0; i < 5; i++) valve.step?.(0.1, pilot(true));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);

    for (let i = 0; i < 6; i++) valve.step?.(0.1, pilot(true));
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('opens again the moment 12 is released, ready for the next pulse', () => {
    const valve = timeDelay({ normallyOpen: true });
    for (let i = 0; i < 15; i++) valve.step?.(0.1, pilot(true));
    valve.step?.(0.1, pilot(false));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('is the one time delay valve with normally open ticked', () => {
    const valve = createTimeDelayValve(layer(), 0, 0);
    valve.restore({ ...valve.snapshot(), normallyOpen: true, delaySec: 2.5 });
    expect(valve.type).toBe(TIME_DELAY_VALVE_TYPE);
    expect(valve.snapshot()).toMatchObject({ normallyOpen: true, delaySec: 2.5 });
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('leaves the plain time delay valve normally closed by default', () => {
    const valve = createTimeDelayValve(layer(), 0, 0);
    expect(valve.type).toBe(TIME_DELAY_VALVE_TYPE);
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('is one library entry, findable as a pulse valve or an off-delay too', () => {
    const entry = componentRegistry.get(TIME_DELAY_VALVE_TYPE);
    expect(entry?.placeable).toBe(true);
    expect(entry?.label).toBe('Time delay valve');
    expect(entry?.keywords).toEqual(expect.arrayContaining(['pulse valve', 'off delay']));
  });

  it('draws the ISO symbol: throttle and check valve, reservoir, in a dash-dot frame', () => {
    const valve = timeDelay({ normallyOpen: true });
    const svg = valve.el.querySelector('svg') as SVGSVGElement;
    expect(svg.querySelector('rect[stroke-dasharray]')).not.toBeNull();
    expect(svg.querySelector('rect[rx]')).not.toBeNull(); // the reservoir
    expect(svg.querySelector('circle:not([data-port])')).not.toBeNull(); // check valve ball
  });
});

describe('time delay valve, off-delay', () => {
  it('switches the moment 12 is pressurized', () => {
    const valve = timeDelay({ offDelay: true });
    expect(valve.snapshot()).toMatchObject({ offDelay: true, normallyOpen: false });
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
    valve.step?.(0.01, pilot(true));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('holds on for the delay after 12 goes away, then switches back', () => {
    const valve = timeDelay({ offDelay: true }); // 1.0 s
    valve.step?.(0.1, pilot(true));
    for (let i = 0; i < 5; i++) valve.step?.(0.1, pilot(false));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
    for (let i = 0; i < 6; i++) valve.step?.(0.1, pilot(false));
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('restarts the wait if 12 comes back before the delay is up', () => {
    const valve = timeDelay({ offDelay: true });
    valve.step?.(0.1, pilot(true));
    for (let i = 0; i < 8; i++) valve.step?.(0.1, pilot(false));
    valve.step?.(0.1, pilot(true));
    for (let i = 0; i < 8; i++) valve.step?.(0.1, pilot(false));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('reset() returns it to rest', () => {
    const valve = timeDelay({ offDelay: true });
    valve.step?.(0.1, pilot(true));
    valve.reset();
    expect(valve.conductivityRule(noPressure)).toEqual(CLOSED);
  });

  it('shows its check valve the other way round from the on-delay one', () => {
    // The check valve's ball sits on the side air flows freely towards: the reservoir for an
    // off-delay (fills at once), port 12 for an on-delay (vents at once). Both are drawn; the
    // setting shows one.
    const ballX = (c: Component): number => {
      const circles = [...c.el.querySelectorAll('svg circle')].filter(
        (el) =>
          !el.hasAttribute('data-port') &&
          Number(el.getAttribute('r')) < 6 &&
          (el.closest('g[style]') as HTMLElement | null)?.style.display !== 'none',
      );
      return Number(circles[0]?.getAttribute('cx'));
    };
    const valve = createTimeDelayValve(layer(), 0, 0);
    const onDelay = ballX(valve);
    valve.restore({ ...valve.snapshot(), offDelay: true });
    expect(ballX(valve)).toBeGreaterThan(onDelay);
    valve.restore({ ...valve.snapshot(), offDelay: false });
    expect(ballX(valve)).toBe(onDelay);
  });

  it('becomes an off-delay when the setting is ticked', () => {
    const valve = createTimeDelayValve(layer(), 0, 0);
    valve.restore({ ...valve.snapshot(), offDelay: true });
    valve.step?.(0.01, pilot(true));
    expect(valve.conductivityRule(noPressure)).toEqual(OPEN);
  });

  it('names itself after its settings', () => {
    const valve = createTimeDelayValve(layer(), 0, 0);
    const name = (): string => valve.el.querySelector('.compNameText')?.textContent ?? '';
    valve.restore({ ...valve.snapshot(), showName: true });
    expect(name()).toBe('Time delay valve, on-delay');
    valve.restore({ ...valve.snapshot(), offDelay: true, normallyOpen: true });
    expect(name()).toBe('Time delay valve, off-delay, normally open');
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
    const valve = add(timeDelay({ normallyOpen: true }));
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
