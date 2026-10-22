import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection, removeConnection } from '../wires/connection';
import { stepSimulation } from './engine';
import { resetFlowNetwork } from './flowNetwork';
import {
  conductanceFromNominal,
  nominalFlowOf,
  nominalFromConductance,
  setNominalFlow,
  criticalRatioOf,
  defaultCriticalRatio,
  setCriticalRatio,
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
import { getDefaultFlowScale, setDefaultFlowScale } from './flowRatings';

// These check the physics at real-world ratings; the slowed-down teaching default is pinned
// separately (flowRatings.test.ts).
const teachingScale = getDefaultFlowScale();
beforeAll(() => setDefaultFlowScale(1));
afterAll(() => setDefaultFlowScale(teachingScale));

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

  it('gives each component its kind’s typical critical ratio b until one is set', () => {
    const c = createCheckValve(layer(), 0, 0);
    expect(criticalRatioOf(c)).toBe(defaultCriticalRatio('checkValve'));
    setCriticalRatio(c, 0.5);
    expect(criticalRatioOf(c)).toBe(0.5);
    setCriticalRatio(c, null);
    expect(criticalRatioOf(c)).toBe(defaultCriticalRatio('checkValve'));
  });

  it('keeps b a ratio below 1', () => {
    const c = createCheckValve(layer(), 0, 0);
    setCriticalRatio(c, 1.5);
    expect(c.flowCriticalRatio).toBeLessThan(1);
    setCriticalRatio(c, -0.2);
    expect(c.flowCriticalRatio).toBe(0);
  });

  it('carries b with the snapshot alongside C', () => {
    const c = createCheckValve(layer(), 0, 0);
    setCriticalRatio(c, 0.42);
    const data = snapshotWithFlowRating(c);
    expect(data).toMatchObject({ flowB: 0.42 });
    expect(data).not.toHaveProperty('flowC');
    const copy = createCheckValve(layer(), 0, 0);
    restoreFlowRating(copy, data);
    expect(copy.flowCriticalRatio).toBe(0.42);
    expect(copy.flowRating).toBeUndefined();
  });

  it('is saved with the project and restored on load', () => {
    const c = createCheckValve(layer(), 0, 0);
    appState.addComponent(c);
    setFlowRating(c, 0.33);
    setCriticalRatio(c, 0.55);
    const file = serializeProject('test');
    loadProject(file, { compLayer: layer() }, viewport);
    expect(appState.components[0]?.flowRating).toBe(0.33);
    expect(appState.components[0]?.flowCriticalRatio).toBe(0.55);
  });
});

describe('flow rating as a standard nominal flow (Nl/min)', () => {
  it('converts C by the ISO 6358 relation at 6 bar in, 5 bar out', () => {
    // q = C · 7 bar · φ(6/7, b) · 60; for b = 0.3, φ = √(1 - ((6/7 - 0.3)/0.7)²).
    const phi = Math.sqrt(1 - ((6 / 7 - 0.3) / 0.7) ** 2);
    expect(nominalFromConductance(0.6, 0.3)).toBeCloseTo(0.6 * 7 * phi * 60, 6);
    expect(conductanceFromNominal(nominalFromConductance(0.6, 0.3), 0.3)).toBeCloseTo(0.6, 9);
  });

  it('gives a component its C from a figure entered in Nl/min', () => {
    const c = createCheckValve(layer(), 0, 0);
    setNominalFlow(c, 300);
    expect(c.flowRating).toBeUndefined();
    expect(flowRatingOf(c)).toBeCloseTo(conductanceFromNominal(300, criticalRatioOf(c)), 9);
    expect(nominalFlowOf(c)).toBe(300);
  });

  it('keeps the entered Nl/min figure when b is changed, deriving a new C', () => {
    const c = createCheckValve(layer(), 0, 0);
    setNominalFlow(c, 300);
    const before = flowRatingOf(c);
    setCriticalRatio(c, 0.1);
    expect(nominalFlowOf(c)).toBe(300);
    expect(flowRatingOf(c)).not.toBeCloseTo(before, 3);
  });

  it('replaces one way of giving the rating with the other', () => {
    const c = createCheckValve(layer(), 0, 0);
    setNominalFlow(c, 300);
    setFlowRating(c, 1);
    expect(c.flowNominal).toBeUndefined();
    setNominalFlow(c, 200);
    expect(c.flowRating).toBeUndefined();
  });

  it('is saved as entered', () => {
    const c = createCheckValve(layer(), 0, 0);
    setNominalFlow(c, 250);
    const data = snapshotWithFlowRating(c);
    expect(data).toMatchObject({ flowQn: 250 });
    expect(data).not.toHaveProperty('flowC');
    const copy = createCheckValve(layer(), 0, 0);
    restoreFlowRating(copy, data);
    expect(copy.flowNominal).toBe(250);
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

  function strokeTime(valveRating: number | null, valveB: number | null = null): number {
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
    setCriticalRatio(valve, valveB);
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

  it('fills a cylinder sooner through a valve with a higher critical ratio', () => {
    // A higher b keeps the flow near its choked maximum down to a smaller pressure drop.
    const low = strokeTime(0.3, 0.05);
    const high = strokeTime(0.3, 0.7);
    expect(high).toBeLessThan(low);
  });

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

  it('sets and clears the component’s own critical ratio b', () => {
    const valve = createValve52Mono(layer(), 0, 0);
    const el = inspectorFor(valve);
    const input = el.querySelector<HTMLInputElement>('.criticalRatioInput') as HTMLInputElement;
    expect(input.placeholder).toBe(String(defaultCriticalRatio('valve52Mono')));
    input.value = '0.45';
    input.dispatchEvent(new Event('change'));
    expect(valve.flowCriticalRatio).toBe(0.45);

    const again = el.querySelector<HTMLInputElement>('.criticalRatioInput') as HTMLInputElement;
    again.value = '';
    again.dispatchEvent(new Event('change'));
    expect(valve.flowCriticalRatio).toBeUndefined();
  });

  it('takes the rating in Nl/min once that unit is chosen, and remembers the choice', () => {
    localStorage.removeItem('pneugineer.flowRatingUnit');
    const valve = createValve52Mono(layer(), 0, 0);
    const el = inspectorFor(valve);
    const unit = el.querySelector<HTMLSelectElement>('.flowRatingUnit') as HTMLSelectElement;
    expect(unit.value).toBe('C');
    unit.value = 'Nl/min';
    unit.dispatchEvent(new Event('change'));

    const input = ratingInput(el) as HTMLInputElement;
    expect(Number(input.placeholder)).toBeGreaterThan(100);
    input.value = '400';
    input.dispatchEvent(new Event('change'));
    expect(valve.flowNominal).toBe(400);
    expect(localStorage.getItem('pneugineer.flowRatingUnit')).toBe('Nl/min');

    // Switching back shows the same rating as C.
    const unitAgain = el.querySelector<HTMLSelectElement>('.flowRatingUnit') as HTMLSelectElement;
    unitAgain.value = 'C';
    unitAgain.dispatchEvent(new Event('change'));
    expect(Number((ratingInput(el) as HTMLInputElement).value)).toBeCloseTo(flowRatingOf(valve), 2);
    localStorage.removeItem('pneugineer.flowRatingUnit');
  });

  it('is not offered for components without air paths', () => {
    const el = inspectorFor(createJunction(layer(), 0, 0));
    expect(ratingInput(el)).toBeNull();
    expect(el.querySelector('.criticalRatioInput')).toBeNull();
  });
});

describe('the teaching default', () => {
  beforeEach(() => {
    setDefaultFlowScale(teachingScale);
    appState.simulationMode = 'flow';
    resetFlowNetwork();
    initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
  });
  afterEach(() => {
    setDefaultFlowScale(1);
    appState.simulationMode = 'logic';
  });

  it('strokes a 32 x 100 mm cylinder on a 5/2 valve in about 1-1.5 s each way', () => {
    const add = <T extends Component>(c: T): T => {
      appState.addComponent(c);
      return c;
    };
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createValve52Mono(layer(), 0, 0));
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '1' });
    createConnection({ id: valve.id, port: '4' }, { id: cyl.id, port: 'A' });
    createConnection({ id: valve.id, port: '2' }, { id: cyl.id, port: 'B' });
    for (let i = 0; i < 300; i++) stepSimulation(0.02);
    const pilot = createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '14' });
    const pos = (): number => (cyl.snapshot() as { pos: number }).pos;

    let out = Infinity;
    for (let t = 0; t < 10; t += 0.02) {
      stepSimulation(0.02);
      if (pos() >= 1) {
        out = t;
        break;
      }
    }
    expect(out).toBeGreaterThan(0.9);
    expect(out).toBeLessThan(1.3);

    // Back again once the pilot is taken away - a little slower, as the larger full-bore chamber
    // now has to empty through the valve's exhaust.
    for (let i = 0; i < 200; i++) stepSimulation(0.02);
    removeConnection(pilot.id);
    let back = Infinity;
    for (let t = 0; t < 10; t += 0.02) {
      stepSimulation(0.02);
      if (pos() <= 0) {
        back = t;
        break;
      }
    }
    expect(back).toBeGreaterThan(out);
    expect(back).toBeLessThan(1.7);
  });

  it('leaves a flow meter at its full rating, so it still barely restricts the line', () => {
    expect(defaultFlowRating('flowMeter')).toBe(2);
    expect(defaultFlowRating('valve52')).toBeCloseTo(0.6 * teachingScale, 9);
  });
});
