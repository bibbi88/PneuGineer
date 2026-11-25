import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { stepSimulation } from './engine';
import { resetFlowNetwork } from './flowNetwork';
import { initWires, createConnection } from '../wires/connection';
import { resetSignals } from './signals';
import { currentRun, recordStep, resetRecorder, seriesId, startRun, type Run } from './recorder';
import { eventTime, eventWindow, ratio, seriesStats } from './diagramAnalysis';
import { createSource } from '../components/source';
import { createCylinderDouble } from '../components/cylinderDouble';
import { createValve52Mono } from '../components/valve52Mono';
import type { Component } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';

/** A run built by hand: power 2 kW for 0-1 s, 4 kW for 1-2 s; signal S1 on at 0.5 s, off at 1.5 s. */
function handRun(): Run {
  const t: number[] = [];
  const v: number[] = [];
  for (let i = 0; i <= 200; i++) {
    t.push(i / 100);
    v.push(i <= 100 ? 2 : 4);
  }
  return {
    t,
    series: new Map([['1:p', { compId: 1, key: 'p', label: 'P', unit: 'kW', values: v }]]),
    signals: new Map([
      [
        'S1',
        [
          { t: 0, on: false },
          { t: 0.5, on: true },
          { t: 1.5, on: false },
        ],
      ],
    ]),
    startedAt: new Date(),
  };
}

describe('diagram analysis', () => {
  it('finds events: start, end, a time, the nth time a signal turns on or off', () => {
    const run = handRun();
    expect(eventTime(run, { kind: 'start' })).toBe(0);
    expect(eventTime(run, { kind: 'end' })).toBe(2);
    expect(eventTime(run, { kind: 'signal', name: 's1', edge: 'on', n: 1 })).toBe(0.5);
    expect(eventTime(run, { kind: 'signal', name: 'S1', edge: 'off', n: 1 })).toBe(1.5);
    expect(eventTime(run, { kind: 'signal', name: 'S1', edge: 'on', n: 2 })).toBeNull();
    expect(
      eventWindow(
        run,
        { kind: 'signal', name: 'S1', edge: 'on', n: 1 },
        { kind: 'signal', name: 'S1', edge: 'off', n: 1 },
      ),
    ).toEqual({ t0: 0.5, t1: 1.5 });
  });

  it('min, max, time average and energy over a window', () => {
    const run = handRun();
    const s = run.series.get('1:p')!;
    const all = seriesStats(run, s, 0, 2);
    expect(all.min).toBe(2);
    expect(all.max).toBe(4);
    expect(all.integral).toBeCloseTo(6, 1); // kJ
    expect(all.mean).toBeCloseTo(3, 1);
    const part = seriesStats(run, s, 0.5, 1.5);
    expect(part.integral).toBeCloseTo(3, 1);
    expect(ratio(run, s, s, 'integral', 0, 2)).toBeCloseTo(1);
  });
});

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

describe('recording a run', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    initWires(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      viewport,
      document.createElement('div'),
    );
    resetFlowNetwork();
    resetSignals();
    resetRecorder();
    appState.simulationMode = 'flow';
    appState.setMode(Modes.PLAY);
  });
  afterEach(() => {
    appState.setMode(Modes.STOP);
  });

  it('records the cylinder, the air it takes and the valve switching over', () => {
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createValve52Mono(layer(), 0, 0));
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    wire(source, 'OUT', valve, '1');
    wire(valve, '4', cyl, 'A');
    wire(valve, '2', cyl, 'B');
    startRun();
    const step = (): void => {
      const graph = stepSimulation(1 / 50);
      recordStep(1 / 50, graph.pressurized);
    };
    for (let i = 0; i < 25; i++) step();
    // Piloted over: A is driven, the rod goes out.
    wire(source, 'OUT', valve, '14');
    for (let i = 0; i < 400; i++) step();

    const run = currentRun()!;
    expect(run.t.length).toBe(425);
    const x = run.series.get(seriesId(cyl.id, 'x'))!;
    const air = run.series.get(seriesId(cyl.id, 'air'))!;
    const supplied = run.series.get(seriesId(source.id, 'q'))!;
    expect(x.unit).toBe('mm');
    expect(Math.max(...x.values)).toBeCloseTo(cyl.snapshot().strokeMm as number, 0);
    // Air in Nl: what the cylinder took over the run, and what the supply gave - about the same.
    const end = run.t[run.t.length - 1]!;
    const took = seriesStats(run, air, 0, end).integral;
    const gave = seriesStats(run, supplied, 0, end).integral;
    expect(took).toBeGreaterThan(0);
    expect(gave).toBeGreaterThan(took * 0.8);
    // The valve switched over once: position 0, then 1.
    const sw = run.series.get(seriesId(valve.id, 'switched'))!;
    expect(sw.values[0]).toBe(0);
    expect(sw.values[sw.values.length - 1]).toBe(1);
  });
});
