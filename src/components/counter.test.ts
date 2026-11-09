import { describe, expect, it } from 'vitest';
import { createCounter } from './counter';
import { componentRegistry } from './registry';
import type { Component, SimStepContext } from '../core/types';

function counterWith(preset: number): Component {
  const c = createCounter(document.createElement('div'), 0, 0);
  c.restore({ ...c.snapshot(), preset });
  return c;
}

/** One frame with Z (12) and Y (10) as given; whether 1 then passes to 2. */
function frame(c: Component, z: boolean, y = false): boolean {
  const ctx = { isPressurized: (p: string) => (p === '12' ? z : p === '10' ? y : false) };
  c.step?.(0.01, ctx as unknown as SimStepContext);
  return c.conductivityRule({ isPressurized: () => false }).some((r) => r.a === '2' && r.b === '1');
}

function pulse(c: Component): boolean {
  frame(c, true);
  return frame(c, false);
}

describe('counter', () => {
  it('switches on the preset count of pulses on Z, not on a held signal', () => {
    const c = counterWith(3);
    expect(pulse(c)).toBe(false);
    // Held: still one count.
    frame(c, true);
    frame(c, true);
    expect(frame(c, false)).toBe(false);
    expect(pulse(c)).toBe(true);
    expect(c.el.textContent).toContain('3');
  });

  it('stays switched until Y resets it, counting nothing while Y is held', () => {
    const c = counterWith(1);
    expect(pulse(c)).toBe(true);
    expect(pulse(c)).toBe(true);
    expect(frame(c, false, true)).toBe(false);
    expect(frame(c, true, true)).toBe(false);
    expect(frame(c, true, false)).toBe(false);
    expect(frame(c, false)).toBe(false);
    expect(pulse(c)).toBe(true);
  });

  it('resets to zero with the simulation, and keeps its preset', () => {
    const c = counterWith(2);
    pulse(c);
    pulse(c);
    c.reset();
    expect(frame(c, false)).toBe(false);
    expect(c.snapshot().preset).toBe(2);
  });

  it('is in the library under Signal processing, with the timer and the sequence valve', () => {
    expect(componentRegistry.get('counter')?.category).toBe('Signal processing');
    expect(componentRegistry.get('timeDelayValve')?.category).toBe('Signal processing');
    expect(componentRegistry.get('pressureSequenceValve')?.category).toBe('Signal processing');
  });
});
