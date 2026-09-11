import { describe, expect, it, vi } from 'vitest';
import { createQuickExhaustValve } from './quickExhaustValve';
import { createOneWayFlowControlValve } from './oneWayFlowControlValve';
import { createTimeDelayValve } from './timeDelayValve';

function compLayer(): HTMLElement {
  return document.createElement('div');
}

function stepCtx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    dt: 0.1,
    isPressurized: () => false,
    flowMultiplierToNearestSource: () => 1,
    emitSignal: vi.fn(),
    readSignal: () => false,
    ...overrides,
  };
}

describe('quickExhaustValve', () => {
  it('passes supply through to the cylinder when port 1 is pressurized', () => {
    const valve = createQuickExhaustValve(compLayer(), 0, 0);
    const edges = valve.conductivityRule({ isPressurized: (p) => p === '1' });
    expect(edges).toEqual([{ a: '1', b: '2' }]);
  });

  it('opens a one-way vent from 2 to 3 when port 1 is not pressurized', () => {
    const valve = createQuickExhaustValve(compLayer(), 0, 0);
    const edges = valve.conductivityRule({ isPressurized: () => false });
    expect(edges).toEqual([{ a: '2', b: '3', directed: true }]);
  });
});

describe('oneWayFlowControlValve', () => {
  it('always conducts IN<->OUT but throttles only the OUT->IN direction', () => {
    const valve = createOneWayFlowControlValve(compLayer(), 0, 0);
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual([{ a: 'IN', b: 'OUT' }]);
    expect(valve.flowMultiplier?.('IN', 'OUT')).toBe(1);
    expect(valve.flowMultiplier?.('OUT', 'IN')).toBeCloseTo(0.5);
  });
});

describe('timeDelayValve', () => {
  it('stays on the exhaust path until the pilot has been held for delaySec', () => {
    const valve = createTimeDelayValve(compLayer(), 0, 0);
    // default delaySec is 1.0s; step with a pressurized pilot in 0.1s increments
    for (let i = 0; i < 5; i++) {
      valve.step?.(0.1, stepCtx({ isPressurized: () => true }));
    }
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual([{ a: '2', b: '3' }]);

    for (let i = 0; i < 6; i++) {
      valve.step?.(0.1, stepCtx({ isPressurized: () => true }));
    }
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual([{ a: '2', b: '1' }]);
  });

  it('resets immediately once the pilot depressurizes', () => {
    const valve = createTimeDelayValve(compLayer(), 0, 0);
    for (let i = 0; i < 15; i++) {
      valve.step?.(0.1, stepCtx({ isPressurized: () => true }));
    }
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual([{ a: '2', b: '1' }]);

    valve.step?.(0.1, stepCtx({ isPressurized: () => false }));
    expect(valve.conductivityRule({ isPressurized: () => false })).toEqual([{ a: '2', b: '3' }]);
  });
});
