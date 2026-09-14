import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';

export const CHECK_VALVE_TYPE = 'checkValve';

const SVG_W = 66;
const SVG_H = 100;
const GX = -12;
const GY = -15;
const HUS_X = 20;
const HUS_Y = 40;
const HUS_W = 50;
const HUS_H = 50;

export function createCheckValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, CHECK_VALVE_TYPE, x, y, SVG_W, SVG_H, '', {
    x: GX + HUS_X,
    y: GY + HUS_Y,
    w: HUS_W,
    h: HUS_H,
  });
  const g = createSvgEl('g', { transform: `translate(${GX},${GY})` });

  g.appendChild(
    createSvgEl('rect', {
      x: HUS_X,
      y: HUS_Y,
      width: HUS_W,
      height: HUS_H,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 3,
    }),
  );

  const cx = HUS_X + HUS_W / 2;
  const yMid = HUS_Y + HUS_H / 2;

  g.appendChild(
    createSvgEl('circle', {
      cx,
      cy: yMid - 5,
      r: 9,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 3,
    }),
  );
  g.appendChild(
    createSvgEl('line', {
      x1: cx - 16,
      y1: yMid - 8,
      x2: cx,
      y2: yMid + 12,
      stroke: '#111',
      'stroke-width': 3,
    }),
  );
  g.appendChild(
    createSvgEl('line', {
      x1: cx + 16,
      y1: yMid - 8,
      x2: cx,
      y2: yMid + 12,
      stroke: '#111',
      'stroke-width': 3,
    }),
  );

  const OUT = { cx, cy: HUS_Y - 10 };
  const IN = { cx, cy: HUS_Y + HUS_H + 10 };
  // These lead-in lines must reach the exact port center (not just close to it), since a
  // connected port's own circle is hidden - any gap between the line and the port position
  // would otherwise show up as a visible blank break in the wire.
  g.appendChild(
    createSvgEl('line', {
      x1: OUT.cx,
      y1: OUT.cy,
      x2: OUT.cx,
      y2: HUS_Y,
      stroke: '#111',
      'stroke-width': 3,
    }),
  );
  g.appendChild(
    createSvgEl('line', {
      x1: IN.cx,
      y1: HUS_Y + HUS_H,
      x2: IN.cx,
      y2: IN.cy,
      stroke: '#111',
      'stroke-width': 3,
    }),
  );
  shell.svg.appendChild(g);

  const ports = {
    IN: createPort(g, 'IN', IN.cx, IN.cy, 'V', { radius: 7 }),
    OUT: createPort(g, 'OUT', OUT.cx, OUT.cy, 'V', { radius: 7 }),
  };

  const comp: Component = {
    id: uid(),
    type: CHECK_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: GX,
    gy: GY,
    ports,

    conductivityRule(ctx): PortConnection[] {
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
