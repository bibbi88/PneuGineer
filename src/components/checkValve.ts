import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const CHECK_VALVE_TYPE = 'checkValve';

const SVG_W = 50;
const SVG_H = 24;

export function createCheckValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, CHECK_VALVE_TYPE, x, y, SVG_W, SVG_H, 'Check');

  const line = createSvgEl('line', {
    x1: 0,
    y1: SVG_H / 2,
    x2: SVG_W,
    y2: SVG_H / 2,
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(line);

  const poppet = createSvgEl('polygon', {
    points: `${SVG_W / 2 - 10},${SVG_H / 2 - 8} ${SVG_W / 2 + 10},${SVG_H / 2} ${SVG_W / 2 - 10},${SVG_H / 2 + 8}`,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(poppet);

  const ports = {
    IN: createPort(shell.svg, 'IN', 0, SVG_H / 2, 'H'),
    OUT: createPort(shell.svg, 'OUT', SVG_W, SVG_H / 2, 'H'),
  };

  const comp: Component = {
    id: uid(),
    type: CHECK_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(ctx: ConductivityContext): PortConnection[] {
      return ctx.isPressurized('IN') ? [{ a: 'IN', b: 'OUT', directed: true }] : [];
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
