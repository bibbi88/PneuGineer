import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const SOURCE_TYPE = 'source';

const SVG_W = 40;
const SVG_H = 40;

export function createSource(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, SOURCE_TYPE, x, y, SVG_W, SVG_H, 'Source');

  const circle = createSvgEl('circle', {
    cx: SVG_W / 2,
    cy: SVG_H / 2,
    r: 14,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(circle);

  const port = createPort(shell.svg, 'OUT', SVG_W / 2, SVG_H, 'V');

  const comp: Component = {
    id: uid(),
    type: SOURCE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports: { OUT: port },

    conductivityRule(): PortConnection[] {
      return [];
    },

    sourcePorts(): string[] {
      return ['OUT'];
    },

    snapshot(): Record<string, unknown> {
      return {};
    },

    restore(): void {
      // no type-specific state to restore
    },

    reset(): void {
      // stateless
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
