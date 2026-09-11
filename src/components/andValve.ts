import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const AND_VALVE_TYPE = 'andValve';

const SVG_W = 60;
const SVG_H = 40;

export function createAndValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, AND_VALVE_TYPE, x, y, SVG_W, SVG_H, 'AND');

  const body = createSvgEl('rect', {
    x: 5,
    y: 5,
    width: SVG_W - 10,
    height: SVG_H - 10,
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
    type: AND_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(ctx: ConductivityContext): PortConnection[] {
      return ctx.isPressurized('A') && ctx.isPressurized('B')
        ? [
            { a: 'A', b: 'OUT' },
            { a: 'B', b: 'OUT' },
          ]
        : [];
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
