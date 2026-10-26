import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { initLibraryDrag, isLibraryDragActive } from './libraryDrag';
import { initKeyboard } from './keyboard';
import { initWires } from '../wires/connection';
import { getComponentRotation } from './componentContextMenu';
import { selectOnly, clearSelection } from './selection';
import { createSource } from '../components/source';
import { VALVE_52_TYPE } from '../components/valve52';
import { CYLINDER_DOUBLE_TYPE } from '../components/cylinderDouble';
import type { ViewportAdapter } from '../ui/viewport';
import { createAndValve, AND_VALVE_TYPE } from '../components/andValve';
import { OR_VALVE_TYPE } from '../components/orValve';
import { createJunction } from '../components/junction';
import { createConnection } from '../wires/connection';
import { initValveActuatorSwap } from './valveActuatorSwap';
import { setComponentRotation } from './componentContextMenu';

const viewport: ViewportAdapter = {
  clientToWorld: (cx, cy) => ({ x: cx, y: cy }),
  applyTransform: () => {},
  getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
  setTransform: () => {},
  setGridVisible: () => {},
};

function key(k: string, shiftKey = false): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, cancelable: true }));
}

function rightClick(): MouseEvent {
  const e = new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true });
  document.body.dispatchEvent(e);
  return e;
}

describe('dragging a component out of the library', () => {
  let compLayer: HTMLElement;
  let workspaceEl: HTMLElement;

  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.setMode(Modes.STOP);
    clearSelection();
    compLayer = document.createElement('div');
    document.body.appendChild(compLayer);
    workspaceEl = document.createElement('div');
    // jsdom has no layout: give the canvas a box so drops can land on it.
    workspaceEl.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000 }) as DOMRect;
    initWires(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement,
      viewport,
      workspaceEl,
    );
    initKeyboard();
  });

  it('shows a see-through preview under the pointer that is not part of the diagram', () => {
    const drag = initLibraryDrag({ compLayer }, viewport, workspaceEl);
    drag.start(VALVE_52_TYPE);
    drag.move(203, 398);

    const ghost = compLayer.querySelector<HTMLElement>('.comp.dragGhost');
    expect(ghost).not.toBeNull();
    expect(ghost?.style.left).toBe('200px');
    expect(ghost?.style.top).toBe('400px');
    expect(appState.components).toHaveLength(0);

    drag.move(1500, 400); // off the canvas
    expect(ghost?.style.display).toBe('none');
    drag.cancel();
    expect(compLayer.querySelector('.dragGhost')).toBeNull();
  });

  it('turns with R (Shift+R back) and a right-click, and is placed turned', () => {
    const drag = initLibraryDrag({ compLayer }, viewport, workspaceEl);
    drag.start(VALVE_52_TYPE);
    drag.move(200, 400);
    key('r');
    key('r');
    key('R', true);
    const e = rightClick();
    expect(e.defaultPrevented).toBe(true);

    const ghost = compLayer.querySelector<HTMLElement>('.comp.dragGhost');
    expect(ghost?.dataset.rot).toBe('180');

    drag.drop(200, 400);
    expect(isLibraryDragActive()).toBe(false);
    expect(compLayer.querySelector('.dragGhost')).toBeNull();
    expect(appState.components).toHaveLength(1);
    const [placed] = appState.components;
    expect(placed?.type).toBe(VALVE_52_TYPE);
    expect(placed && getComponentRotation(placed)).toBe(180);
    expect(placed?.x).toBe(200);
  });

  it('places nothing when dropped outside the canvas or cancelled with Escape', () => {
    const drag = initLibraryDrag({ compLayer }, viewport, workspaceEl);
    drag.start(VALVE_52_TYPE);
    drag.move(200, 400);
    drag.drop(1500, 400);
    expect(appState.components).toHaveLength(0);

    drag.start(VALVE_52_TYPE);
    drag.move(200, 400);
    key('Escape');
    expect(isLibraryDragActive()).toBe(false);
    drag.drop(200, 400);
    expect(appState.components).toHaveLength(0);
  });

  it("doesn't use up a cylinder letter for the preview", () => {
    const drag = initLibraryDrag({ compLayer }, viewport, workspaceEl);
    drag.start(CYLINDER_DOUBLE_TYPE);
    drag.move(200, 400);
    drag.move(220, 400);
    drag.drop(220, 400);
    expect(appState.components[0]?.snapshot().letter).toBe('A');
  });
});

describe('R rotates the selection', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.setMode(Modes.STOP);
    initKeyboard();
  });

  it('a quarter clockwise, Shift+R counter-clockwise, and not while simulating', () => {
    const source = createSource(document.createElement('div'), 100, 100);
    appState.addComponent(source);
    selectOnly(source.id);

    key('r');
    expect(getComponentRotation(source)).toBe(90);
    key('R', true);
    key('R', true);
    expect(getComponentRotation(source)).toBe(270);

    appState.setMode(Modes.PLAY);
    key('r');
    expect(getComponentRotation(source)).toBe(270);
  });
});

describe('dropping an AND/OR valve onto the other', () => {
  it('swaps it in place, keeping its wires and how it is turned', () => {
    appState.components = [];
    appState.connections = [];
    appState.setMode(Modes.STOP);
    const compLayer = document.createElement('div');
    const workspaceEl = document.createElement('div');
    workspaceEl.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000 }) as DOMRect;
    initWires(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement,
      viewport,
      workspaceEl,
    );
    initValveActuatorSwap({ compLayer }, viewport);

    const and = createAndValve(compLayer, 400, 300);
    appState.addComponent(and);
    setComponentRotation(and, 90);
    const ends = ['A', 'B', 'OUT'].map((port, i) => {
      const j = createJunction(compLayer, 100 + i * 100, 600, 'V');
      appState.addComponent(j);
      createConnection({ id: j.id, port: 'P' }, { id: and.id, port });
      return j;
    });

    const drag = initLibraryDrag({ compLayer }, viewport, workspaceEl);
    drag.start(OR_VALVE_TYPE);
    drag.move(400, 300);
    expect(and.el.classList.contains('swapTarget')).toBe(true);
    drag.drop(400, 300);

    const valves = appState.components.filter(
      (c) => c.type === AND_VALVE_TYPE || c.type === OR_VALVE_TYPE,
    );
    expect(valves).toHaveLength(1);
    const or = valves[0]!;
    expect(or.type).toBe(OR_VALVE_TYPE);
    expect([or.x, or.y]).toEqual([400, 300]);
    expect(getComponentRotation(or)).toBe(90);
    expect(appState.connections).toHaveLength(3);
    ends.forEach((j, i) =>
      expect(appState.connections.find((c) => c.from.id === j.id)?.to).toEqual({
        id: or.id,
        port: ['A', 'B', 'OUT'][i],
      }),
    );
    expect(compLayer.querySelector('.swapTarget')).toBeNull();
  });

  it('places a new valve as usual when dropped beside, not on, the other kind', () => {
    appState.components = [];
    appState.connections = [];
    const compLayer = document.createElement('div');
    const workspaceEl = document.createElement('div');
    workspaceEl.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000 }) as DOMRect;
    const and = createAndValve(compLayer, 400, 300);
    appState.addComponent(and);
    const drag = initLibraryDrag({ compLayer }, viewport, workspaceEl);
    drag.start(OR_VALVE_TYPE);
    drag.move(700, 300);
    drag.drop(700, 300);
    expect(appState.components.map((c) => c.type).sort()).toEqual(
      [AND_VALVE_TYPE, OR_VALVE_TYPE].sort(),
    );
  });
});
