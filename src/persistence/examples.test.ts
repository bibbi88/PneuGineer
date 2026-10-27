import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires } from '../wires/connection';
import { loadProject } from './project';
import { EXAMPLES } from './examples';
import { stepSimulation } from '../sim/engine';
import { resetFlowNetwork } from '../sim/flowNetwork';
import type { ViewportAdapter } from '../ui/viewport';

const viewport: ViewportAdapter = {
  clientToWorld: (x, y) => ({ x, y }),
  applyTransform: () => {},
  getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
  setTransform: () => {},
  setGridVisible: () => {},
};

function pos(type: string): number {
  const cyl = appState.components.find((c) => c.type === type);
  return (cyl?.snapshot() as { pos: number }).pos;
}

function press(name: string, down: boolean): void {
  const button = appState.components.find((c) => c.snapshot().customName === name);
  button?.restore({ ...button.snapshot(), active: down });
}

describe('example circuits', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    resetFlowNetwork();
    initWires(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      viewport,
      document.createElement('div'),
    );
  });

  it('load with every part and wire, cylinders named A with sensors A0/A1', () => {
    for (const ex of EXAMPLES) {
      const file = ex.file();
      loadProject(file, { compLayer: document.createElement('div') }, viewport);
      expect(appState.components).toHaveLength(file.comps.length);
      expect(appState.connections).toHaveLength(file.conns.length);
      for (const c of appState.components.filter((c) => c.type.startsWith('cylinder'))) {
        const snap = c.snapshot() as {
          letter: string;
          pos: number;
          sensors: Array<{ label: string }>;
        };
        expect(snap.letter).toBe('A');
        expect(snap.pos).toBe(0);
        expect(snap.sensors.map((s) => s.label)).toEqual(['A0', 'A1']);
      }
    }
  });

  it('work: the cylinder goes out on Start and, in the automatic cycle, comes back by itself', () => {
    const run = (s: number): void => {
      for (let t = 0; t < s; t += 0.02) stepSimulation(0.02);
    };
    const load = (i: number): void =>
      loadProject(EXAMPLES[i]!.file(), { compLayer: document.createElement('div') }, viewport);

    load(0);
    press('Start', true);
    run(3);
    expect(pos('cylinderSingle')).toBe(1);

    load(1);
    press('Start', true);
    run(6);
    expect(pos('cylinderDouble')).toBe(1);

    load(2);
    press('Start', true);
    let extended = false;
    for (let t = 0; t < 5 && !extended; t += 0.02) {
      stepSimulation(0.02);
      extended = pos('cylinderDouble') === 1;
    }
    expect(extended).toBe(true);
    press('Start', false);
    run(5);
    expect(pos('cylinderDouble')).toBe(0);
  });
});
