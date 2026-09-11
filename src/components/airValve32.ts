import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const AIR_VALVE_32_TYPE = 'airValve32';

const SVG_W = 70;
const SVG_H = 50;

export function createAirValve32(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, AIR_VALVE_32_TYPE, x, y, SVG_W, SVG_H, '3/2 Air');

  const body = createSvgEl('rect', {
    x: 10,
    y: 10,
    width: SVG_W - 25,
    height: SVG_H - 20,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(body);

  const pilotTriangle = createSvgEl('polygon', {
    points: `${SVG_W - 15},${SVG_H / 2 - 8} ${SVG_W - 15},${SVG_H / 2 + 8} ${SVG_W - 3},${SVG_H / 2}`,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 1.5,
  });
  shell.svg.appendChild(pilotTriangle);

  const ports = {
    '2': createPort(shell.svg, '2', SVG_W / 2 - 7, 10, 'V'),
    '1': createPort(shell.svg, '1', SVG_W * 0.25, SVG_H - 10, 'V'),
    '3': createPort(shell.svg, '3', SVG_W * 0.55, SVG_H - 10, 'V'),
    '12': createPort(shell.svg, '12', SVG_W - 3, SVG_H / 2, 'H', { isPilot: true, pilotDir: 1 }),
  };

  let active = false;

  const comp: Component = {
    id: uid(),
    type: AIR_VALVE_32_TYPE,
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

    onPressureChange(ctx: ConductivityContext): void {
      active = ctx.isPressurized('12');
    },

    snapshot(): Record<string, unknown> {
      return { active };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
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
