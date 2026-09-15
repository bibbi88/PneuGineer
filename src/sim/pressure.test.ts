import { describe, expect, it } from 'vitest';
import type { Component, Connection } from '../core/types';
import { computeFrameGraph, flowMultiplierToNearestSource, portKey } from './pressure';
import { createSource } from '../components/source';
import { createAndValve } from '../components/andValve';
import { createOrValve } from '../components/orValve';
import { createCheckValve } from '../components/checkValve';
import { createRestrictor } from '../components/restrictor';
import { createValve52 } from '../components/valve52';
import { createValve52Mono } from '../components/valve52Mono';
import { createOneWayFlowControlValve } from '../components/oneWayFlowControlValve';

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

    // Defaults to state 1 (1<->2, 4<->5) when freshly placed.
    const before = valve.conductivityRule({ isPressurized: () => false });
    expect(before).toEqual(expect.arrayContaining([expect.objectContaining({ a: '1', b: '2' })]));

    valve.onPressureChange?.({ isPressurized: (p) => p === '14' });

    const after = valve.conductivityRule({ isPressurized: () => false });
    expect(after).toEqual(expect.arrayContaining([expect.objectContaining({ a: '1', b: '4' })]));
  });

  it('valve52 ignores a simultaneous rising edge on both pilots (ambiguous command)', () => {
    const valve = createValve52(compLayer(), 0, 0);
    const before = valve.conductivityRule({ isPressurized: () => false });

    valve.onPressureChange?.({ isPressurized: () => true });

    const after = valve.conductivityRule({ isPressurized: () => false });
    expect(after).toEqual(before);
  });

  it('valve52 ignores a pilot rising edge while the other pilot is already held on', () => {
    const valve = createValve52(compLayer(), 0, 0);

    // Hold pilot 12 on for a tick first (matches the default state, so this alone is a no-op).
    valve.onPressureChange?.({ isPressurized: (p) => p === '12' });
    const afterFirstPilot = valve.conductivityRule({ isPressurized: () => false });

    // Now 14 also rises while 12 is still held - this must NOT move the valve, even though 14
    // itself is a fresh rising edge (only its simultaneous-rise guard would have missed this).
    valve.onPressureChange?.({ isPressurized: () => true });
    const afterBothHeld = valve.conductivityRule({ isPressurized: () => false });
    expect(afterBothHeld).toEqual(afterFirstPilot);

    // And the reverse order: hold 14 first, then bring 12 up while 14 is still held.
    const valve2 = createValve52(compLayer(), 0, 0);
    valve2.onPressureChange?.({ isPressurized: (p) => p === '14' });
    const afterFirstPilot2 = valve2.conductivityRule({ isPressurized: () => false });

    valve2.onPressureChange?.({ isPressurized: () => true });
    const afterBothHeld2 = valve2.conductivityRule({ isPressurized: () => false });
    expect(afterBothHeld2).toEqual(afterFirstPilot2);
  });

  it('valve52 obeys the remaining pilot once the other one is removed', () => {
    const valve = createValve52(compLayer(), 0, 0);

    // Hold 12 (matches the default state 1), then bring 14 up too - blocked, stays at state 1.
    valve.onPressureChange?.({ isPressurized: (p) => p === '12' });
    valve.onPressureChange?.({ isPressurized: () => true });
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual(
      expect.arrayContaining([expect.objectContaining({ a: '1', b: '2' })]),
    );

    // Now 14 drops out while 12 is still held - 12 should immediately win now that the
    // ambiguity is gone, even though 12 itself never had a fresh rising edge here.
    valve.onPressureChange?.({ isPressurized: (p) => p === '12' });
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual(
      expect.arrayContaining([expect.objectContaining({ a: '1', b: '2' })]),
    );

    // Symmetric case: get the valve into state 0 via 14, hold both, then drop 12 - 14 should
    // win and flip the valve even though it never got a fresh rising edge of its own either.
    const valve2 = createValve52(compLayer(), 0, 0);
    valve2.onPressureChange?.({ isPressurized: (p) => p === '14' });
    valve2.onPressureChange?.({ isPressurized: () => true });
    expect(valve2.conductivityRule({ isPressurized: () => false })).toEqual(
      expect.arrayContaining([expect.objectContaining({ a: '1', b: '4' })]),
    );

    valve2.onPressureChange?.({ isPressurized: (p) => p === '14' });
    expect(valve2.conductivityRule({ isPressurized: () => false })).toEqual(
      expect.arrayContaining([expect.objectContaining({ a: '1', b: '4' })]),
    );
  });

  it("valve52Mono is spring-return: position always follows the single pilot's current level", () => {
    const valve = createValve52Mono(compLayer(), 0, 0);

    // Default (unpowered) rest position matches the bistable valve's own default: 1<->2, 4<->5.
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual(
      expect.arrayContaining([expect.objectContaining({ a: '1', b: '2' })]),
    );

    // Pilot 14 pressurized -> shifts immediately, no rising-edge needed.
    valve.onPressureChange?.({ isPressurized: () => true });
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual(
      expect.arrayContaining([expect.objectContaining({ a: '1', b: '4' })]),
    );

    // Pilot released -> the spring pulls it straight back, the same tick, no held state.
    valve.onPressureChange?.({ isPressurized: () => false });
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual(
      expect.arrayContaining([expect.objectContaining({ a: '1', b: '2' })]),
    );
  });

  it('restrictor throttles flow via flowMultiplier without blocking topology', () => {
    const restrictor = createRestrictor(compLayer(), 0, 0);
    expect(restrictor.conductivityRule({ isPressurized: () => false })).toEqual([
      { a: 'IN', b: 'OUT' },
    ]);
    expect(restrictor.flowMultiplier?.('IN', 'OUT')).toBeCloseTo(0.5);
  });

  it('one-way flow control valve only throttles the OUT->IN direction, not IN->OUT too', () => {
    const sourceOnIn = createSource(compLayer(), 0, 0);
    const valve = createOneWayFlowControlValve(compLayer(), 0, 0);
    const forwardConnections = [wire(sourceOnIn.id, 'OUT', valve.id, 'IN')];

    const forwardGraph = computeFrameGraph([sourceOnIn, valve], forwardConnections, nextVersion());
    expect(flowMultiplierToNearestSource(forwardGraph, portKey(valve.id, 'OUT'))).toBeCloseTo(1);

    const sourceOnOut = createSource(compLayer(), 0, 0);
    const reverseConnections = [wire(sourceOnOut.id, 'OUT', valve.id, 'OUT')];

    const reverseGraph = computeFrameGraph([sourceOnOut, valve], reverseConnections, nextVersion());
    expect(flowMultiplierToNearestSource(reverseGraph, portKey(valve.id, 'IN'))).toBeCloseTo(0.5);
  });
});
