import { describe, expect, it } from 'vitest';
import { createCylinderDouble } from './cylinderDouble';
import { createCylinderSingle } from './cylinderSingle';
import { createValve52 } from './valve52';
import { createRestrictor } from './restrictor';

function compLayer(): HTMLElement {
  return document.createElement('div');
}

describe('component snapshot/restore round-trips', () => {
  it('cylinderDouble persists its letter as real state, not scraped from label text', () => {
    const original = createCylinderDouble(compLayer(), 0, 0);
    const snap = original.snapshot();
    expect(snap.letter).toBe('A');

    // simulate a fresh app session: a brand new instance restoring saved data
    const restored = createCylinderDouble(compLayer(), 10, 10);
    restored.restore(snap);
    expect(restored.snapshot()).toEqual(snap);
  });

  it('cylinderSingle round-trips mode and normallyExtended', () => {
    const original = createCylinderSingle(compLayer(), 0, 0);
    const snap = original.snapshot();

    const restored = createCylinderSingle(compLayer(), 0, 0);
    restored.restore(snap);
    expect(restored.snapshot()).toEqual(snap);
  });

  it('valve52 round-trips its state', () => {
    const original = createValve52(compLayer(), 0, 0);
    original.onPressureChange?.({ isPressurized: (p) => p === '12' });
    const snap = original.snapshot();
    expect(snap.state).toBe(1);

    const restored = createValve52(compLayer(), 0, 0);
    restored.restore(snap);
    expect(restored.snapshot()).toEqual(snap);
  });

  it('restrictor round-trips flowPct', () => {
    const original = createRestrictor(compLayer(), 0, 0);
    const snap = original.snapshot();

    const restored = createRestrictor(compLayer(), 0, 0);
    restored.restore(snap);
    expect(restored.snapshot()).toEqual(snap);
  });
});
