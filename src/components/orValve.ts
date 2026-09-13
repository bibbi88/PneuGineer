import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createLabeledPort } from './shared/svgHelpers';

export const OR_VALVE_TYPE = 'orValve';

const SVG_W = 200;
const SVG_H = 102;
const GX = 10;
const GY = -26;
const HUS_X = 40;
const HUS_Y = 60;
const HUS_W = 100;
const HUS_H = 60;

function line(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
  return createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': 2 });
}
function rect(x: number, y: number, w: number, h: number): SVGRectElement {
  return createSvgEl('rect', {
    x,
    y,
    width: w,
    height: h,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
}

export function createOrValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, OR_VALVE_TYPE, x, y, SVG_W, SVG_H, '');
  const g = createSvgEl('g', { transform: `translate(${GX},${GY})` });

  const yMid = HUS_Y + HUS_H / 2;
  const xMid = HUS_X + HUS_W / 2;
  const leftSeatX = HUS_X + 16;
  const rightSeatX = HUS_X + HUS_W - 16;

  g.append(
    rect(HUS_X, HUS_Y, HUS_W, HUS_H),
    line(HUS_X, yMid, leftSeatX, yMid),
    line(rightSeatX, yMid, HUS_X + HUS_W, yMid),
    line(leftSeatX, yMid, leftSeatX + 15, yMid - 12),
    line(leftSeatX, yMid, leftSeatX + 15, yMid + 12),
    line(rightSeatX, yMid, rightSeatX - 15, yMid - 12),
    line(rightSeatX, yMid, rightSeatX - 15, yMid + 12),
    createSvgEl('circle', {
      cx: xMid - 19,
      cy: yMid,
      r: 8,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
    line(xMid, yMid, xMid, HUS_Y),
    line(rightSeatX, yMid, leftSeatX + 23, yMid),
  );

  const A = { cx: HUS_X - 20, cy: yMid };
  const B = { cx: HUS_X + HUS_W + 20, cy: yMid };
  const OUT = { cx: xMid, cy: HUS_Y - 20 };

  // These lead-in lines must reach the exact port center (not just close to it), since a
  // connected port's own circle is hidden - any gap between the line and the port position
  // would otherwise show up as a visible blank break in the wire.
  g.append(
    line(HUS_X, A.cy, A.cx, A.cy),
    line(HUS_X + HUS_W, B.cy, B.cx, B.cy),
    line(OUT.cx, OUT.cy, OUT.cx, HUS_Y),
  );
  shell.svg.appendChild(g);

  const ports = {
    A: createLabeledPort(g, 'A', A.cx, A.cy, 'H', 'left'),
    B: createLabeledPort(g, 'B', B.cx, B.cy, 'H', 'left'),
    OUT: createLabeledPort(g, 'OUT', OUT.cx, OUT.cy, 'V', 'left'),
  };

  const comp: Component = {
    id: uid(),
    type: OR_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: GX,
    gy: GY,
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
