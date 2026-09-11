import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const RESTRICTOR_TYPE = 'restrictor';

const SVG_W = 50;
const SVG_H = 24;
const DEFAULT_FLOW_PCT = 50;

export function createRestrictor(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, RESTRICTOR_TYPE, x, y, SVG_W, SVG_H, 'Restrictor');

  const line = createSvgEl('line', {
    x1: 0,
    y1: SVG_H / 2,
    x2: SVG_W,
    y2: SVG_H / 2,
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(line);

  const throat = createSvgEl('polygon', {
    points: `${SVG_W / 2 - 10},${SVG_H / 2 - 9} ${SVG_W / 2 + 10},${SVG_H / 2 - 9} ${SVG_W / 2 + 6},${SVG_H / 2 + 9} ${SVG_W / 2 - 6},${SVG_H / 2 + 9}`,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(throat);

  const ports = {
    IN: createPort(shell.svg, 'IN', 0, SVG_H / 2, 'H'),
    OUT: createPort(shell.svg, 'OUT', SVG_W, SVG_H / 2, 'H'),
  };

  let flowPct = DEFAULT_FLOW_PCT;

  const comp: Component = {
    id: uid(),
    type: RESTRICTOR_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return [{ a: 'IN', b: 'OUT' }];
    },

    flowMultiplier(): number {
      return flowPct / 100;
    },

    snapshot(): Record<string, unknown> {
      return { flowPct };
    },
    restore(data: Record<string, unknown>): void {
      flowPct = data.flowPct as number;
    },
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
