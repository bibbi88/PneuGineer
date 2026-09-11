import { describe, expect, it } from 'vitest';
import type { Component, Connection } from '../core/types';
import { computeFrameGraph, portKey } from './pressure';
import { createSource } from '../components/source';
import { createAndValve } from '../components/andValve';
import { createOrValve } from '../components/orValve';
import { createCheckValve } from '../components/checkValve';
import { createRestrictor } from '../components/restrictor';
import { createValve52 } from '../components/valve52';

let version = 0;
function nextVersion(): number {
  return ++version;
}

function compLayer(): HTMLElement {
  return document.createElement('div');
}

function wire(fromId: number, fromPort: string, toId: number, toPort: string): Connection {
  return {
    id: 0,
    from: { id: fromId, port: fromPort },
    to: { id: toId, port: toPort },
    guides: [],
    stubStartLen: null,
    stubEndLen: null,
    pathEl: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    hitEl: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    labelEl: document.createElementNS('http://www.w3.org/2000/svg', 'text'),
  };
}

describe('computeFrameGraph', () => {
  it('propagates pressure from a source through wires', () => {
    const source = createSource(compLayer(), 0, 0);
    const target: Component = createSource(compLayer(), 0, 0);
    const connections = [wire(source.id, 'OUT', target.id, 'OUT')];

    const graph = computeFrameGraph([source, target], connections, nextVersion());

    expect(graph.pressurized.has(portKey(source.id, 'OUT'))).toBe(true);
    expect(graph.pressurized.has(portKey(target.id, 'OUT'))).toBe(true);
  });

  it('AND valve only conducts when both inputs are pressurized', () => {
    const sourceA = createSource(compLayer(), 0, 0);
    const sourceB = createSource(compLayer(), 0, 0);
    const and = createAndValve(compLayer(), 0, 0);
    const connections = [
      wire(sourceA.id, 'OUT', and.id, 'A'),
      wire(sourceB.id, 'OUT', and.id, 'B'),
    ];

    const graph = computeFrameGraph([sourceA, sourceB, and], connections, nextVersion());
    expect(graph.pressurized.has(portKey(and.id, 'OUT'))).toBe(true);
  });

  it('AND valve does not conduct with only one input pressurized', () => {
    const sourceA = createSource(compLayer(), 0, 0);
    const and = createAndValve(compLayer(), 0, 0);
    const connections = [wire(sourceA.id, 'OUT', and.id, 'A')];

    const graph = computeFrameGraph([sourceA, and], connections, nextVersion());
    expect(graph.pressurized.has(portKey(and.id, 'OUT'))).toBe(false);
  });

  it('OR valve conducts with either input pressurized', () => {
    const sourceA = createSource(compLayer(), 0, 0);
    const or = createOrValve(compLayer(), 0, 0);
    const connections = [wire(sourceA.id, 'OUT', or.id, 'A')];

    const graph = computeFrameGraph([sourceA, or], connections, nextVersion());
    expect(graph.pressurized.has(portKey(or.id, 'OUT'))).toBe(true);
  });

  it('check valve blocks backward flow', () => {
    const source = createSource(compLayer(), 0, 0);
    const check = createCheckValve(compLayer(), 0, 0);
    // wire the source to the check valve's OUT (i.e. pressurizing from the "wrong" side)
    const connections = [wire(source.id, 'OUT', check.id, 'OUT')];

    const graph = computeFrameGraph([source, check], connections, nextVersion());
    expect(graph.pressurized.has(portKey(check.id, 'IN'))).toBe(false);
  });

  it('check valve allows forward flow', () => {
    const source = createSource(compLayer(), 0, 0);
    const check = createCheckValve(compLayer(), 0, 0);
    const connections = [wire(source.id, 'OUT', check.id, 'IN')];

    const graph = computeFrameGraph([source, check], connections, nextVersion());
    expect(graph.pressurized.has(portKey(check.id, 'OUT'))).toBe(true);
  });

  it('valve52 toggles which ports connect after a pilot rising edge', () => {
    const valve = createValve52(compLayer(), 0, 0);

    const before = valve.conductivityRule({ isPressurized: () => false });
    expect(before).toEqual(expect.arrayContaining([expect.objectContaining({ a: '1', b: '2' })]));

    valve.onPressureChange?.({ isPressurized: (p) => p === '12' });

    const after = valve.conductivityRule({ isPressurized: () => false });
    expect(after).toEqual(expect.arrayContaining([expect.objectContaining({ a: '1', b: '4' })]));
  });

  it('restrictor throttles flow via flowMultiplier without blocking topology', () => {
    const restrictor = createRestrictor(compLayer(), 0, 0);
    expect(restrictor.conductivityRule({ isPressurized: () => false })).toEqual([
      { a: 'IN', b: 'OUT' },
    ]);
    expect(restrictor.flowMultiplier?.('IN', 'OUT')).toBeCloseTo(0.5);
  });
});
