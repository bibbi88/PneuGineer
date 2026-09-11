import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';
import { getSignal } from '../sim/signals';

export const LIMIT_VALVE_32_TYPE = 'limitValve32';

const SVG_W = 60;
const SVG_H = 50;
// Cylinder end-of-stroke signals are always emitted as "<UPPERCASE letter><0|1>" (see
// components/shared/letters.ts + cylinderDouble/cylinderSingle's emitSignal calls), so the
// default here must match that case or a freshly-placed limit valve senses nothing at all.
const DEFAULT_SENSOR_KEY = 'A0';

export function createLimitValve32(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(
    compLayer,
    LIMIT_VALVE_32_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    '3/2 Limit',
  );

  const body = createSvgEl('rect', {
    x: 10,
    y: 10,
    width: SVG_W - 20,
    height: SVG_H - 20,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(body);

  const roller = createSvgEl('circle', {
    cx: SVG_W / 2,
    cy: 6,
    r: 4,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 1.5,
  });
  shell.svg.appendChild(roller);

  const ports = {
    '2': createPort(shell.svg, '2', SVG_W / 2, 10, 'V'),
    '1': createPort(shell.svg, '1', SVG_W * 0.3, SVG_H - 10, 'V'),
    '3': createPort(shell.svg, '3', SVG_W * 0.7, SVG_H - 10, 'V'),
  };

  let active = false;
  let sensorKey = DEFAULT_SENSOR_KEY;

  const comp: Component = {
    id: uid(),
    type: LIMIT_VALVE_32_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return active ? [{ a: '2', b: '1' }] : [{ a: '2', b: '3' }];
    },

    recompute(): void {
      active = getSignal(sensorKey);
    },

    snapshot(): Record<string, unknown> {
      return { active, sensorKey };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
      sensorKey = data.sensorKey as string;
    },
    reset(): void {
      active = false;
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  return comp;
}
