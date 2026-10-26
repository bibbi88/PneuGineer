import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { initWires, createConnection, removeConnection } from '../wires/connection';
import { stepSimulation } from './engine';
import { portKey } from './pressure';
import { flowPressureAt, resetFlowNetwork } from './flowNetwork';
import { createSource } from '../components/source';
import { createValve52Mono } from '../components/valve52Mono';
import { createCylinderDouble } from '../components/cylinderDouble';
import { createPressureSequenceValve } from '../components/pressureSequenceValve';
import { createPressureReducingValve } from '../components/pressureReducingValve';
import { createOneWayFlowControlValve } from '../components/oneWayFlowControlValve';
import { createCylinderSingle } from '../components/cylinderSingle';
import { createPushButton32 } from '../components/pushButton32';
import { createThrottleValve } from '../components/throttleValve';
import { createTimeDelayValve } from '../components/timeDelayValve';
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

function add<T extends Component>(c: T): T {
  appState.addComponent(c);
  return c;
}
function wire(a: Component, ap: string, b: Component, bp: string): void {
  createConnection({ id: a.id, port: ap }, { id: b.id, port: bp });
}
function pos(c: Component): number {
  return (c.snapshot() as { pos: number }).pos;
}
function bar(c: Component, port: string): number {
  return flowPressureAt(portKey(c.id, port)) ?? NaN;
}

beforeEach(() => {
  appState.components = [];
  appState.connections = [];
  appState.simulationMode = 'flow';
  resetFlowNetwork();
  initWires(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewport, layer());
});
afterEach(() => {
  appState.simulationMode = 'logic';
});

/** Source -> 5/2 valve -> cylinder, settled retracted (B at supply), then switched to extend. */
function cylinderCircuit(): { source: Component; valve: Component; cyl: Component } {
  const source = add(createSource(layer(), 0, 0));
  const valve = add(createValve52Mono(layer(), 0, 0));
  const cyl = add(createCylinderDouble(layer(), 0, 0));
  wire(source, 'OUT', valve, '1');
  wire(valve, '4', cyl, 'A');
  wire(valve, '2', cyl, 'B');
  for (let i = 0; i < 25; i++) stepSimulation(0.02);
  return { source, valve, cyl };
}

describe('flow network', () => {
  it('holds a supply line at supply pressure', () => {
    const { source, valve } = cylinderCircuit();
    expect(bar(source, 'OUT')).toBeCloseTo(6, 5);
    expect(bar(valve, '1')).toBeCloseTo(6, 5);
  });

  it('never pushes a line above the supply pressure filling it', () => {
    // Close to equilibrium the flow formula is very steep; stepped naively, a line overshoots
    // and then sits above supply pressure, oscillating around it.
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createValve52Mono(layer(), 0, 0));
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    wire(source, 'OUT', valve, '1');
    wire(valve, '4', cyl, 'A');
    wire(valve, '2', cyl, 'B');
    let highest = 0;
    for (let i = 0; i < 150; i++) {
      stepSimulation(0.02);
      highest = Math.max(highest, bar(cyl, 'B'), bar(valve, '2'));
    }
    expect(highest).toBeLessThanOrEqual(6 + 1e-6);
    expect(bar(cyl, 'B')).toBeCloseTo(6, 3);
  });

  it('fills the line to a retracted cylinder’s rod side, and leaves the other empty', () => {
    const { cyl } = cylinderCircuit();
    expect(bar(cyl, 'B')).toBeGreaterThan(5.9);
    expect(bar(cyl, 'A')).toBeLessThan(0.1);
  });

  it('shows a driving line below supply pressure while the piston moves, full once it stops', () => {
    const { source, valve, cyl } = cylinderCircuit();
    wire(source, 'OUT', valve, '14');
    let lowest = Infinity;
    for (let i = 0; i < 100 && pos(cyl) < 1; i++) {
      stepSimulation(0.01);
      if (pos(cyl) > 0.2 && pos(cyl) < 0.8) lowest = Math.min(lowest, bar(cyl, 'A'));
    }
    expect(pos(cyl)).toBe(1);
    // While air is streaming in, the restrictions on the way drop the pressure.
    expect(lowest).toBeLessThan(5.5);
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    expect(bar(cyl, 'A')).toBeGreaterThan(5.9);
    expect(bar(cyl, 'B')).toBeLessThan(0.1);
  });

  it('limits a line fed through a pressure reducing valve to its setting', () => {
    const source = add(createSource(layer(), 0, 0));
    const reducer = add(createPressureReducingValve(layer(), 0, 0));
    reducer.restore({ ...reducer.snapshot(), outletPressure: 2.5 });
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    wire(source, 'OUT', reducer, 'IN');
    wire(reducer, 'OUT', cyl, 'A');
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    expect(bar(cyl, 'A')).toBeGreaterThan(2.2);
    expect(bar(cyl, 'A')).toBeLessThanOrEqual(2.55);
  });

  it('lets a pressure sequence valve on a meter-in line switch only at the end of stroke', () => {
    // The classic arrangement: the supply to A is throttled (meter-in), so while the piston
    // moves the line to A stays well below supply pressure, and only rises - to the sequence
    // valve's setting - once the piston stops at the end of its stroke.
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createValve52Mono(layer(), 0, 0));
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    const meterIn = add(createOneWayFlowControlValve(layer(), 0, 0));
    meterIn.restore({ ...meterIn.snapshot(), flowPct: 20 });
    const seq = add(createPressureSequenceValve(layer(), 0, 0));
    seq.restore({ ...seq.snapshot(), setPressure: 5 });
    wire(source, 'OUT', valve, '1');
    // Throttled valve -> cylinder (OUT -> IN), free on the way back.
    wire(valve, '4', meterIn, 'OUT');
    wire(meterIn, 'IN', cyl, 'A');
    wire(valve, '2', cyl, 'B');
    wire(source, 'OUT', seq, '1');
    wire(cyl, 'A', seq, '12');
    for (let i = 0; i < 25; i++) stepSimulation(0.02);
    wire(source, 'OUT', valve, '14');

    let switchedAt = -1;
    for (let i = 0; i < 500; i++) {
      const graph = stepSimulation(0.01);
      if (graph.pressurized.has(portKey(seq.id, '2'))) {
        switchedAt = pos(cyl);
        break;
      }
    }
    expect(switchedAt).toBe(1);
  });
});

describe('a frame with no time in it', () => {
  it('leaves every pressure and the piston as they were, instead of turning them into NaN', () => {
    const { source, valve, cyl } = cylinderCircuit();
    const before = [bar(cyl, 'A'), bar(cyl, 'B'), pos(cyl)];
    stepSimulation(0);
    expect([bar(cyl, 'A'), bar(cyl, 'B'), pos(cyl)]).toEqual(before);
    // ...and the circuit carries on working.
    wire(source, 'OUT', valve, '14');
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    expect(Number.isFinite(bar(cyl, 'A'))).toBe(true);
    expect(pos(cyl)).toBeGreaterThan(0.9);
  });
});

describe('single-acting cylinder in flow mode', () => {
  function single(data: Record<string, unknown> = {}): Component {
    const cyl = add(createCylinderSingle(layer(), 0, 0));
    cyl.restore({ ...cyl.snapshot(), ...data });
    return cyl;
  }

  it('extends on air in push mode', () => {
    const source = add(createSource(layer(), 0, 0));
    const cyl = single();
    wire(source, 'OUT', cyl, 'A');
    for (let i = 0; i < 100 && pos(cyl) < 1; i++) stepSimulation(0.01);
    expect(pos(cyl)).toBe(1);
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    expect(bar(cyl, 'A')).toBeGreaterThan(5.9);
  });

  it('is returned by its spring once its air is let out', () => {
    // A normally-closed push-button valve, at rest, vents the cylinder through its port 3.
    const source = add(createSource(layer(), 0, 0));
    const button = add(createPushButton32(layer(), 0, 0));
    const cyl = single({ pos: 1 });
    wire(source, 'OUT', button, '1');
    wire(button, '2', cyl, 'A');
    for (let i = 0; i < 200 && pos(cyl) > 0; i++) stepSimulation(0.01);
    expect(pos(cyl)).toBe(0);
  });

  it('retracts on air in pull mode', () => {
    const source = add(createSource(layer(), 0, 0));
    const cyl = single({ pos: 1, mode: 'pull', normallyExtended: true });
    wire(source, 'OUT', cyl, 'A');
    for (let i = 0; i < 200 && pos(cyl) > 0; i++) stepSimulation(0.01);
    expect(pos(cyl)).toBe(0);
  });

  it('cannot push a load heavier than its air force less its spring', () => {
    const source = add(createSource(layer(), 0, 0));
    // 32 mm at 6 bar: about 480 N of air, of which the spring takes 30-70 N.
    const cyl = single({ loadN: 450 });
    wire(source, 'OUT', cyl, 'A');
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    expect(pos(cyl)).toBeLessThan(1);
  });
});

describe('pilots in flow mode', () => {
  /** Supply -> 5/2 valve -> cylinder; the valve's pilot 14 fed from the supply through a
   * throttle set to `pilotFlowPct`, with a long pilot line. Returns the time until the cylinder
   * starts moving. */
  function timeToStart(pilotFlowPct: number): number {
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createValve52Mono(layer(), 0, 0));
    const cyl = add(createCylinderDouble(layer(), 0, 0));
    wire(source, 'OUT', valve, '1');
    wire(valve, '4', cyl, 'A');
    wire(valve, '2', cyl, 'B');
    for (let i = 0; i < 25; i++) stepSimulation(0.02);
    const throttle = add(createThrottleValve(layer(), 0, 0));
    throttle.restore({ ...throttle.snapshot(), flowPct: pilotFlowPct });
    wire(source, 'OUT', throttle, 'IN');
    wire(throttle, 'OUT', valve, '14');
    for (let t = 0; t < 5; t += 0.01) {
      stepSimulation(0.01);
      if (pos(cyl) > 0.01) return t;
    }
    return Infinity;
  }

  it('switch their valve only once the pilot line has built up pressure', () => {
    const quick = timeToStart(100);
    appState.components = [];
    appState.connections = [];
    resetFlowNetwork();
    const slow = timeToStart(2);
    expect(quick).toBeLessThan(0.2);
    expect(slow).toBeGreaterThan(quick);
  });

  it('switch at once in logic mode, whatever the pilot line', () => {
    appState.simulationMode = 'logic';
    expect(timeToStart(2)).toBeLessThan(0.05);
  });
});

describe('time delay valve in flow mode', () => {
  /** Source on 1 and, through its own wire, on 12. Returns the valve and that pilot wire. */
  function delayCircuit(variant: 'NC' | 'NO' | 'OFF', delaySec: number) {
    const source = add(createSource(layer(), 0, 0));
    const valve = add(createTimeDelayValve(layer(), 0, 0));
    valve.restore({
      ...valve.snapshot(),
      normallyOpen: variant === 'NO',
      offDelay: variant === 'OFF',
    });
    valve.restore({ ...valve.snapshot(), delaySec });
    wire(source, 'OUT', valve, '1');
    const pilot = createConnection({ id: source.id, port: 'OUT' }, { id: valve.id, port: '12' });
    return { valve, pilot };
  }
  /** Seconds until port 2 is (or, with `on` false, is no longer) pressurized. */
  function timeUntil(valve: Component, on: boolean, limit = 6): number {
    for (let t = 0; t < limit; t += 0.01) {
      const graph = stepSimulation(0.01);
      if (graph.pressurized.has(portKey(valve.id, '2')) === on) return t;
    }
    return Infinity;
  }

  it('switches on after about its set delay, filling its reservoir through the throttle', () => {
    const { valve } = delayCircuit('NC', 1);
    const t = timeUntil(valve, true);
    expect(t).toBeGreaterThan(0.8);
    expect(t).toBeLessThan(1.3);
  });

  it('takes about twice as long when set to twice the delay', () => {
    const { valve } = delayCircuit('NC', 2);
    const t = timeUntil(valve, true);
    expect(t).toBeGreaterThan(1.7);
    expect(t).toBeLessThan(2.5);
  });

  it('as a pulse valve, gives a pulse about as long as its delay', () => {
    const { valve } = delayCircuit('NO', 1);
    expect(timeUntil(valve, true, 0.2)).toBeLessThan(0.2);
    const off = timeUntil(valve, false);
    expect(off).toBeGreaterThan(0.7);
    expect(off).toBeLessThan(1.3);
  });

  it('as an off-delay, switches at once and holds for about its delay after the signal goes', () => {
    const { valve, pilot } = delayCircuit('OFF', 1);
    expect(timeUntil(valve, true, 0.3)).toBeLessThan(0.3);
    for (let i = 0; i < 20; i++) stepSimulation(0.01);
    removeConnection(pilot.id);
    const t = timeUntil(valve, false);
    expect(t).toBeGreaterThan(0.8);
    expect(t).toBeLessThan(1.4);
  });
});

describe('air consumption in flow mode', () => {
  function consumption(source: Component): string {
    return source.el.querySelector('.consumptionLabel')?.textContent ?? '';
  }

  it('shows the air a cylinder draws while it moves, and none once it has stopped', () => {
    const { source, valve, cyl } = cylinderCircuit();
    for (let i = 0; i < 50; i++) stepSimulation(0.02);
    expect(consumption(source)).toBe('0 l/min');

    wire(source, 'OUT', valve, '14');
    let peak = 0;
    for (let i = 0; i < 40 && pos(cyl) < 1; i++) {
      stepSimulation(0.01);
      peak = Math.max(peak, parseFloat(consumption(source)));
    }
    // A 32 mm cylinder making a 0.2 s stroke at 6 bar draws air at a few hundred l/min.
    expect(peak).toBeGreaterThan(50);
    for (let i = 0; i < 100; i++) stepSimulation(0.02);
    expect(consumption(source)).toBe('0 l/min');
  });

  it('shows nothing in logic mode', () => {
    appState.simulationMode = 'logic';
    const { source } = cylinderCircuit();
    stepSimulation(0.02);
    expect((source.el.querySelector('.consumptionLabel') as HTMLElement).style.display).toBe(
      'none',
    );
  });
});
