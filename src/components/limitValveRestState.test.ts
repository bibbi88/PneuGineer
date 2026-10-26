import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { createLimitValve32 } from './limitValve32';
import { createCylinderDouble } from './cylinderDouble';
import { createCylinderSingle } from './cylinderSingle';
import { buildExportSvg } from '../persistence/exportImage';
import type { Component } from '../core/types';

function layer(): HTMLElement {
  return document.createElement('div');
}

function limitValve(sensorKey: string): Component {
  const valve = createLimitValve32(layer(), 0, 0);
  appState.addComponent(valve);
  valve.restore({ ...valve.snapshot(), sensorKey });
  return valve;
}

/** x of the valve's sliding body - it moves over when the valve is drawn actuated. */
function moverX(valve: Component): number {
  const mover = valve.el.querySelector('svg.compSvg > g');
  return Number(/translate\(([-\d.]+)/.exec(mover?.getAttribute('transform') ?? '')?.[1]);
}

function camShown(valve: Component): boolean {
  return valve.el.querySelector<SVGElement>('.limitValveCam')?.style.display !== 'none';
}

describe('limit valves drawn in the initial position while stopped', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.setMode(Modes.STOP);
  });

  it('draws a valve on a0 actuated, with the cam on its roller, while cylinder A is retracted', () => {
    appState.addComponent(createCylinderDouble(layer(), 300, 0));
    const a0 = limitValve('a0');
    const a1 = limitValve('A1');

    expect(camShown(a0)).toBe(true);
    expect(camShown(a1)).toBe(false);
    expect(moverX(a0)).toBeGreaterThan(moverX(a1));
  });

  it('only changes the drawing - the saved state stays at rest', () => {
    appState.addComponent(createCylinderDouble(layer(), 300, 0));
    const a0 = limitValve('A0');
    expect(camShown(a0)).toBe(true);
    expect(a0.snapshot().active).toBe(false);
  });

  it('follows a single-acting cylinder that rests extended', () => {
    const cyl = createCylinderSingle(layer(), 300, 0);
    appState.addComponent(cyl);
    cyl.restore({ ...cyl.snapshot(), normallyExtended: true, pos: 1 });
    const a1 = limitValve('A1');
    const a0 = limitValve('A0');
    expect(camShown(a1)).toBe(true);
    expect(camShown(a0)).toBe(false);
  });

  it('updates when the valve is given a sensor, and leaves an unbound valve alone', () => {
    appState.addComponent(createCylinderDouble(layer(), 300, 0));
    const valve = limitValve('');
    expect(camShown(valve)).toBe(false);
    valve.restore({ ...valve.snapshot(), sensorKey: 'A0' });
    expect(camShown(valve)).toBe(true);
  });

  it('is in the export too', () => {
    appState.addComponent(createCylinderDouble(layer(), 300, 0));
    limitValve('A0');
    const svg = buildExportSvg(
      document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
      null,
      'auto',
    );
    const cam = svg.querySelector<SVGElement>('.limitValveCam');
    expect(cam).not.toBeNull();
    expect(cam?.style.display).not.toBe('none');
  });

  it('goes back to what the simulation says once it runs, and to the rest drawing on stop', () => {
    appState.addComponent(createCylinderDouble(layer(), 300, 0));
    const a0 = limitValve('A0');
    appState.setMode(Modes.PLAY);
    a0.recompute?.(); // no signals emitted yet
    expect(camShown(a0)).toBe(false);
    a0.reset();
    appState.setMode(Modes.STOP);
    expect(camShown(a0)).toBe(true);
  });
});
