import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { solveElectrical } from './electrical';
import { resetSignals, getSignal } from './signals';
import {
  createElecRailPlus,
  createElecRailZero,
  createElecCoil,
  createElecContact,
  createElecLamp,
} from '../components/electrical';
import { createValve52Solenoid } from '../components/solenoidValves';
import type { Component } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';

const viewport: ViewportAdapter = {
  clientToWorld: (cx, cy) => ({ x: cx, y: cy }),
  applyTransform: () => {},
  getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
  setTransform: () => {},
  setGridVisible: () => {},
};
const layer = (): HTMLElement => document.createElement('div');

function add(c: Component): Component {
  appState.addComponent(c);
  return c;
}
function wire(a: Component, ap: string, b: Component, bp: string): void {
  createConnection({ id: a.id, port: ap }, { id: b.id, port: bp });
}
function configure(c: Component, patch: Record<string, unknown>): void {
  c.restore({ ...c.snapshot(), ...patch });
}

describe('solveElectrical', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    resetSignals();
    initWires(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement,
      viewport,
      document.createElement('div'),
    );
  });

  it('energizes a coil wired between +24 V and 0 V and publishes its name', () => {
    const plus = add(createElecRailPlus(layer(), 0, 0));
    const zero = add(createElecRailZero(layer(), 0, 300));
    const coil = add(createElecCoil(layer(), 0, 150));
    wire(plus, 'P', coil, 'A');
    wire(coil, 'B', zero, 'P');

    solveElectrical();
    expect(getSignal('Y1')).toBe(true);
  });

  it('does not energize a coil that is only connected on one side', () => {
    const plus = add(createElecRailPlus(layer(), 0, 0));
    const coil = add(createElecCoil(layer(), 0, 150));
    wire(plus, 'P', coil, 'A');

    solveElectrical();
    expect(getSignal('Y1')).toBe(false);
  });

  it('a relay chain settles in one solve: K1 closes a contact that energizes the lamp', () => {
    const plus = add(createElecRailPlus(layer(), 0, 0));
    const zero = add(createElecRailZero(layer(), 0, 600));
    const k1 = add(createElecCoil(layer(), 0, 150));
    configure(k1, { key: 'K1' });
    wire(plus, 'P', k1, 'A');
    wire(k1, 'B', zero, 'P');

    const contact = add(createElecContact(layer(), 200, 150));
    configure(contact, { key: 'K1' });
    const lamp = add(createElecLamp(layer(), 200, 300));
    wire(plus, 'P', contact, 'A');
    wire(contact, 'B', lamp, 'A');
    wire(lamp, 'B', zero, 'P');

    solveElectrical();
    expect(getSignal('K1')).toBe(true);
    const bulb = lamp.el.querySelector('circle:not(.port)');
    expect(bulb?.getAttribute('fill')).toBe('#ffe45c');
  });

  it('a normally-closed contact opens when its signal is true', () => {
    const plus = add(createElecRailPlus(layer(), 0, 0));
    const zero = add(createElecRailZero(layer(), 0, 600));
    const nc = add(createElecContact(layer(), 200, 150));
    configure(nc, { key: 'S1', normallyClosed: true });
    const coil = add(createElecCoil(layer(), 200, 300));
    wire(plus, 'P', nc, 'A');
    wire(nc, 'B', coil, 'A');
    wire(coil, 'B', zero, 'P');

    solveElectrical();
    expect(getSignal('Y1')).toBe(true);
  });

  it('a solenoid valve shifts while the coil with its name is energized', () => {
    const plus = add(createElecRailPlus(layer(), 0, 0));
    const zero = add(createElecRailZero(layer(), 0, 300));
    const coil = add(createElecCoil(layer(), 0, 150));
    wire(plus, 'P', coil, 'A');
    wire(coil, 'B', zero, 'P');
    const valve = add(createValve52Solenoid(layer(), 400, 150));

    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual([
      { a: '1', b: '2' },
      { a: '4', b: '5' },
    ]);
    solveElectrical();
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual([
      { a: '1', b: '4' },
      { a: '2', b: '3' },
    ]);
  });
});
