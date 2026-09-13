import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const JUNCTION_TYPE = 'junction';

const SVG_W = 14;
const SVG_H = 14;

export function createJunction(
  compLayer: HTMLElement,
  x: number,
  y: number,
  entryOrientation: 'H' | 'V' = 'H',
): Component {
  const shell = buildComponentShell(compLayer, JUNCTION_TYPE, x, y, SVG_W, SVG_H, '');

  const dot = createSvgEl('circle', {
    cx: SVG_W / 2,
    cy: SVG_H / 2,
    r: 4,
    fill: '#111',
  });
  shell.svg.appendChild(dot);

  const ports = {
    P: createPort(shell.svg, 'P', SVG_W / 2, SVG_H / 2, entryOrientation, { radius: 4 }),
  };

  const comp: Component = {
    id: uid(),
    type: JUNCTION_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return [];
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
