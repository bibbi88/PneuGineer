import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const OR_VALVE_TYPE = 'orValve';

const SVG_W = 60;
const SVG_H = 40;

export function createOrValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, OR_VALVE_TYPE, x, y, SVG_W, SVG_H, 'OR');

  const body = createSvgEl('rect', {
    x: 5,
    y: 5,
    width: SVG_W - 10,
    height: SVG_H - 10,
    rx: 8,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(body);

  const ports = {
    A: createPort(shell.svg, 'A', 0, 12, 'H'),
    B: createPort(shell.svg, 'B', 0, SVG_H - 12, 'H'),
    OUT: createPort(shell.svg, 'OUT', SVG_W, SVG_H / 2, 'H'),
  };

  const comp: Component = {
    id: uid(),
    type: OR_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(ctx: ConductivityContext): PortConnection[] {
      const edges: PortConnection[] = [];
      if (ctx.isPressurized('A')) edges.push({ a: 'A', b: 'OUT' });
      if (ctx.isPressurized('B')) edges.push({ a: 'B', b: 'OUT' });
      return edges;
    },

    snapshot(): Record<string, unknown> {
      return {};
    },
    restore(): void {},
    reset(): void {},

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
