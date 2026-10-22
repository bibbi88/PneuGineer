import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection } from '../wires/connection';
import { stepSimulation } from './engine';
import { resetFlowNetwork } from './flowNetwork';
import {
  defaultFlowRating,
  flowRatingOf,
  hasFlowRating,
  restoreFlowRating,
  setFlowRating,
  snapshotWithFlowRating,
} from './flowRatings';
import { serializeProject, loadProject } from '../persistence/project';
import { renderInspector } from '../ui/inspector';
import { selectOnly, clearSelection } from '../interaction/selection';
import { createSource } from '../components/source';
import { createValve52Mono } from '../components/valve52Mono';
import { createCylinderDouble } from '../components/cylinderDouble';
import { createCheckValve } from '../components/checkValve';
import { createJunction } from '../components/junction';
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

beforeEach(() => {
  appState.components = [];
  appState.connections = [];
  clearSelection();
});

describe('flow ratings', () => {
  it('gives each pneumatic component its kind’s typical value until one is set', () => {
    const push = createCheckValve(layer(), 0, 0);
    expect(flowRatingOf(push)).toBe(defaultFlowRating('checkValve'));
    setFlowRating(push, 0.25);
    expect(flowRatingOf(push)).toBe(0.25);
    setFlowRating(push, null);
    expect(flowRatingOf(push)).toBe(defaultFlowRating('checkValve'));
  });

  it('only rates components that pass air', () => {
    expect(hasFlowRating('valve52')).toBe(true);
    expect(hasFlowRating('cylinderDouble')).toBe(true);
    expect(hasFlowRating('junction')).toBe(false);
    expect(hasFlowRating('elecLamp')).toBe(false);
    expect(hasFlowRating('plc')).toBe(false);
  });

  it('keeps a setting within sensible bounds', () => {
    const c = createCheckValve(layer(), 0, 0);
    setFlowRating(c, -1);
    expect(c.flowRating).toBeGreaterThan(0);
    setFlowRating(c, 1e6);
    expect(c.flowRating).toBeLessThanOrEqual(50);
  });

  it('travels with the component’s snapshot, and only when set', () => {
    const c = createCheckValve(layer(), 0, 0);
    expect(snapshotWithFlowRating(c)).not.toHaveProperty('flowC');
    setFlowRating(c, 1.2);
    const copy = createCheckValve(layer(), 0, 0);
    restoreFlowRating(copy, snapshotWithFlowRating(c));
    expect(copy.flowRating).toBe(1.2);
  });

  it('is saved with the project and restored on load', () => {
    const c = createCheckValve(layer(), 0, 0);
    appState.addComponent(c);
    setFlowRating(c, 0.33);
    const file = serializeProject('test');
    loadProject(file, { compLayer: layer() }, viewport);
    expect(appState.components[0]?.flowRating).toBe(0.33);
  });
});

describe('flow ratings in the simulation', () => {
  beforeEach(() => {
    appState.simulationMode = 'flow';
    resetFlowNetwork();
    initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
  });
  afterEach(() => {
    appState.simulationMode = 'logic';
  });

  function strokeTime(valveRating: number | null): number {
    appState.components = [];
    appState.connections = [];
    resetFlowNetwork();
    const add = <T extends Component>(c: T): T => {
      appState.addComponent(c);
      return c;
    };
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createValve52Mono(layer(), 0, 0));
    setFlowRating(valve, valveRating);
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '1' });
    createConnection({ id: valve.id, port: '4' }, { id: cyl.id, port: 'A' });
    createConnection({ id: valve.id, port: '2' }, { id: cyl.id, port: 'B' });
    for (let i = 0; i < 25; i++) stepSimulation(0.02);
    createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '14' });
    for (let t = 0; t < 5; t += 0.01) {
      stepSimulation(0.01);
      if ((cyl.snapshot() as { pos: number }).pos >= 1) return t;
    }
    return Infinity;
  }

  it('makes a cylinder slower behind a smaller valve', () => {
    const typical = strokeTime(null);
    const small = strokeTime(0.1);
    expect(small).toBeGreaterThan(typical * 2);
  });
});

describe('flow rating in the inspector', () => {
  function inspectorFor(comp: Component): HTMLElement {
    appState.addComponent(comp);
    const container = document.createElement('div');
    renderInspector(container, { getName: () => 'test', setName: () => {} });
    selectOnly(comp.id);
    return container;
  }
  const ratingInput = (el: HTMLElement): HTMLInputElement | null =>
    el.querySelector<HTMLInputElement>('.flowRatingInput');

  it('shows the typical value as a placeholder for a component with no setting of its own', () => {
    const input = ratingInput(inspectorFor(createCheckValve(layer(), 0, 0)));
    expect(input?.value).toBe('');
    expect(input?.placeholder).toBe(String(defaultFlowRating('checkValve')));
  });

  it('sets the component’s own rating, and clearing it goes back to typical', () => {
    const valve = createValve52Mono(layer(), 0, 0);
    const el = inspectorFor(valve);
    const input = ratingInput(el) as HTMLInputElement;
    input.value = '0.9';
    input.dispatchEvent(new Event('change'));
    expect(valve.flowRating).toBe(0.9);

    const again = ratingInput(el) as HTMLInputElement;
    again.value = '';
    again.dispatchEvent(new Event('change'));
    expect(valve.flowRating).toBeUndefined();
  });

  it('is not offered for components without air paths', () => {
    expect(ratingInput(inspectorFor(createJunction(layer(), 0, 0)))).toBeNull();
  });
});
