import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { createCylinderDouble } from './cylinderDouble';
import { isSensorTriggeredAtRest } from './shared/sensorPositions';

function pos(c: { snapshot(): Record<string, unknown> }): number {
  return c.snapshot().pos as number;
}

describe('double-acting cylinder: start extended', () => {
  beforeEach(() => {
    appState.components = [];
    appState.setMode(Modes.STOP);
  });

  it('stands extended while stopped, starts each run from there, and says so to its sensors', () => {
    const cyl = createCylinderDouble(document.createElement('div'), 0, 0);
    appState.addComponent(cyl);
    expect(pos(cyl)).toBe(0);

    cyl.restore({ ...cyl.snapshot(), startExtended: true });
    expect(pos(cyl)).toBe(1);
    expect(isSensorTriggeredAtRest('A1')).toBe(true);
    expect(isSensorTriggeredAtRest('A0')).toBe(false);

    appState.setMode(Modes.PLAY);
    cyl.restore({ ...cyl.snapshot(), pos: 0.4 });
    expect(pos(cyl)).toBe(0.4); // a run keeps its own position
    cyl.reset();
    expect(pos(cyl)).toBe(1);

    appState.setMode(Modes.STOP);
    cyl.restore({ ...cyl.snapshot(), startExtended: false });
    expect(pos(cyl)).toBe(0);
  });

  it('is saved with the project', () => {
    const cyl = createCylinderDouble(document.createElement('div'), 0, 0);
    cyl.restore({ ...cyl.snapshot(), startExtended: true });
    const copy = createCylinderDouble(document.createElement('div'), 0, 0);
    copy.restore(cyl.snapshot());
    expect(copy.snapshot().startExtended).toBe(true);
    expect(pos(copy)).toBe(1);
  });
});
