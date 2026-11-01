import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { initWires, createConnection, redrawAllConnections } from './connection';
import { tapLinks } from './taps';
import { createJunction } from '../components/junction';
import { createSource } from '../components/source';
import { createCylinderSingle } from '../components/cylinderSingle';
import { stepSimulation } from '../sim/engine';
import { loadProject, serializeProject } from '../persistence/project';
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

/** jsdom has no layout: each port is where the test puts it. */
const portAt = new Map<Element, { x: number; y: number }>();
function place(c: Component, port: string, x: number, y: number): void {
  const el = c.ports[port]?.el;
  if (el) portAt.set(el, { x, y });
}

let rectSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  appState.components = [];
  appState.connections = [];
  appState.lineJumps = true;
  appState.setMode(Modes.STOP);
  portAt.clear();
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const p = portAt.get(this) ?? { x: 0, y: 0 };
    return {
      left: p.x,
      top: p.y,
      right: p.x,
      bottom: p.y,
      width: 0,
      height: 0,
      x: p.x,
      y: p.y,
      toJSON: () => ({}),
    };
  });
  initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
});
afterEach(() => rectSpy.mockRestore());

function junction(x: number, y: number, o: 'H' | 'V' = 'H'): Component {
  const j = createJunction(layer(), x, y, o);
  appState.addComponent(j);
  place(j, 'P', x, y);
  return j;
}

describe('a branch joined onto a wire without cutting it (a tap)', () => {
  function tapCircuit(): { source: Component; end: Component; tap: Component; cyl: Component } {
    const source = createSource(layer(), 0, 0);
    appState.addComponent(source);
    const end = junction(300, 0);
    createConnection({ id: source.id, port: 'OUT' }, { id: end.id, port: 'P' });
    const tap = junction(150, 0, 'V');
    tap.restore({
      ...tap.snapshot(),
      host: { from: { id: source.id, port: 'OUT' }, to: { id: end.id, port: 'P' } },
    });
    const cyl = createCylinderSingle(layer(), 150, 200);
    appState.addComponent(cyl);
    createConnection({ id: tap.id, port: 'P' }, { id: cyl.id, port: 'A' });
    return { source, end, tap, cyl };
  }

  it('leaves the wire in one piece, and the branch gets its air', () => {
    const { cyl } = tapCircuit();
    expect(appState.connections).toHaveLength(2);
    expect(tapLinks()).toHaveLength(1);
    appState.simulationMode = 'logic';
    appState.setMode(Modes.PLAY);
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    expect((cyl.snapshot() as { pos: number }).pos).toBe(1);
    appState.simulationMode = 'flow';
  });

  it('stays a tap through save and load', () => {
    tapCircuit();
    const file = serializeProject('t');
    loadProject(file, { compLayer: layer() }, viewport);
    expect(appState.connections).toHaveLength(2);
    expect(tapLinks()).toHaveLength(1);
  });
});

describe('line jumps', () => {
  it('jumps a horizontal wire over a vertical one it crosses, unless switched off', () => {
    const a = junction(0, 100);
    const b = junction(300, 100);
    const c = junction(150, 0, 'V');
    const d = junction(150, 200, 'V');
    const across = createConnection({ id: a.id, port: 'P' }, { id: b.id, port: 'P' });
    const down = createConnection({ id: c.id, port: 'P' }, { id: d.id, port: 'P' });
    redrawAllConnections();
    expect(across.pathEl.getAttribute('d')).toContain(' A 5 5 ');
    expect(down.pathEl.getAttribute('d')).not.toContain(' A ');

    appState.lineJumps = false;
    redrawAllConnections();
    expect(across.pathEl.getAttribute('d')).not.toContain(' A ');
  });
});
