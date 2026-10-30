import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { createCylinderDouble } from './cylinderDouble';
import { createCylinderSingle } from './cylinderSingle';
import { createLimitValve32 } from './limitValve32';
import { createElecContact } from './electrical';
import type { Component } from '../core/types';

const layer = (): HTMLElement => document.createElement('div');

function marks(cyl: Component): Array<{ label: string; x: number }> {
  return Array.from(cyl.el.querySelectorAll('.sensorMarkLabel')).map((t) => ({
    label: t.textContent ?? '',
    x: Number(t.getAttribute('x')),
  }));
}

describe('sensor marks at the cylinder rod', () => {
  beforeEach(() => {
    appState.components = [];
  });

  it('shows only the sensors something reads, a0 at the rod in and a1 out', () => {
    const cyl = createCylinderDouble(layer(), 0, 0);
    appState.addComponent(cyl);
    expect(marks(cyl)).toEqual([]);

    const a1 = createLimitValve32(layer(), 0, 0);
    appState.addComponent(a1);
    a1.restore({ ...a1.snapshot(), sensorKey: 'A1' });
    appState.markDirty(); // as the inspector does after a change
    expect(marks(cyl).map((m) => m.label)).toEqual(['a1']);

    const contact = createElecContact(layer(), 0, 0);
    appState.addComponent(contact);
    contact.restore({ ...contact.snapshot(), key: 'a0' });
    appState.markDirty(); // as the inspector does after a change
    const both = marks(cyl);
    expect(both.map((m) => m.label)).toEqual(['a0', 'a1']);
    expect(both[1]!.x).toBeGreaterThan(both[0]!.x);

    appState.removeComponent(a1.id);
    expect(marks(cyl).map((m) => m.label)).toEqual(['a0']);
  });

  it('follows a sensor moved along the stroke, and works on a single-acting cylinder', () => {
    const cyl = createCylinderSingle(layer(), 0, 0);
    appState.addComponent(cyl);
    const valve = createLimitValve32(layer(), 0, 0);
    appState.addComponent(valve);
    valve.restore({ ...valve.snapshot(), sensorKey: 'A0' });
    appState.markDirty(); // as the inspector does after a change
    const at0 = marks(cyl)[0]!.x;
    cyl.restore({ ...cyl.snapshot(), sensors: [{ label: 'A0', minPct: 48, maxPct: 52 }] });
    appState.markDirty(); // as the inspector does after a change
    expect(marks(cyl)[0]!.x).toBeGreaterThan(at0);
  });
});
