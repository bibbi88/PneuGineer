import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createLabeledPort } from './shared/svgHelpers';

export const AND_VALVE_TYPE = 'andValve';

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

export function createAndValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, AND_VALVE_TYPE, x, y, SVG_W, SVG_H, '');
  const g = createSvgEl('g', { transform: `translate(${GX},${GY})` });

  const yMid = HUS_Y + HUS_H / 2;
  const leftX = HUS_X + 35;
  const rightX = HUS_X + HUS_W - 35;

  g.append(
    rect(HUS_X, HUS_Y, HUS_W, HUS_H),
    line(leftX - 20, HUS_Y, leftX - 20, HUS_Y + 23),
    line(leftX - 27, HUS_Y + 15, leftX - 27, HUS_Y + HUS_H - 15),
    line(leftX - 20, HUS_Y + HUS_H, leftX - 20, HUS_Y + HUS_H - 23),
    line(rightX + 20, HUS_Y, rightX + 20, HUS_Y + 23),
    line(rightX + 27, HUS_Y + 15, rightX + 27, HUS_Y + HUS_H - 15),
    line(rightX + 20, HUS_Y + HUS_H, rightX + 20, HUS_Y + HUS_H - 23),
    line(leftX - 27, yMid, rightX + 27, yMid),
  );

  const A = { cx: HUS_X - 20, cy: yMid };
  const B = { cx: HUS_X + HUS_W + 20, cy: yMid };
  const OUT = { cx: HUS_X + HUS_W / 2, cy: HUS_Y - 20 };

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
    type: AND_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: GX,
    gy: GY,
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
