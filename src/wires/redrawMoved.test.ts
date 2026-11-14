import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { createConnection, initWires, redrawMovedConnections } from './connection';
import { createCounter } from '../components/counter';
import { createSource } from '../components/source';
import { createCylinderDouble } from '../components/cylinderDouble';
import type { SimStepContext } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';

const viewport: ViewportAdapter = {
  clientToWorld: (x, y) => ({ x, y }),
  applyTransform: () => {},
  getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
  setTransform: () => {},
  setGridVisible: () => {},
};

let compLayer: HTMLElement;

beforeEach(() => {
  appState.components = [];
  appState.connections = [];
  const workspace = document.createElement('div');
  compLayer = document.createElement('div');
  workspace.appendChild(compLayer);
  initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, workspace);
});

describe('redrawing wires during a run', () => {
  it('redraws only the wires on a component whose ports moved', () => {
    const source = createSource(compLayer, 0, 0);
    const counter = createCounter(compLayer, 300, 0);
    const cyl = createCylinderDouble(compLayer, 600, 0);
    for (const c of [source, counter, cyl]) appState.addComponent(c);
    counter.restore({ ...counter.snapshot(), preset: 1 });
    createConnection({ id: source.id, port: 'OUT' }, { id: counter.id, port: '12' });
    createConnection({ id: source.id, port: 'OUT' }, { id: cyl.id, port: 'A' });
    redrawMovedConnections(); // whatever setting up moved

    // A frame where nothing moved: nothing to redraw.
    expect(redrawMovedConnections()).toBe(0);

    // The cylinder's rod moves - no port with it.
    cyl.restore({ ...cyl.snapshot(), pos: 0.5 });
    expect(redrawMovedConnections()).toBe(0);

    // The counter reaches its preset: its valve slides, ports and all - its one wire redrawn.
    const ctx = { isPressurized: (p: string) => p === '12' } as unknown as SimStepContext;
    counter.step?.(0.01, ctx);
    expect(redrawMovedConnections()).toBe(1);
  });
});
