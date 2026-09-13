import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';

export const SOURCE_TYPE = 'source';

const SVG_W = 46;
const SVG_H = 73;
const GX = -27;
const GY = 0;
const CX = 50;
const CY = 50;
const R = 15;

export function createSource(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, SOURCE_TYPE, x, y, SVG_W, SVG_H, '');
  const g = createSvgEl('g', { transform: `translate(${GX},${GY})` });

  g.appendChild(
    createSvgEl('circle', {
      cx: CX,
      cy: CY,
      r: R,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  g.appendChild(
    createSvgEl('circle', {
      cx: CX,
      cy: CY,
      r: R * 0.55,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  // Reaches the exact port center (not just close to it), since a connected port's own circle
  // is hidden - any gap between the stem and the port position would otherwise show up as a
  // visible blank break in the wire.
  g.appendChild(
    createSvgEl('line', { x1: CX, y1: CY - R, x2: CX, y2: 14, stroke: '#111', 'stroke-width': 2 }),
  );
  shell.svg.appendChild(g);

  const port = createPort(g, 'OUT', CX, 14, 'V');

  const comp: Component = {
    id: uid(),
    type: SOURCE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: GX,
    gy: GY,
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
