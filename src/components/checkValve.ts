import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';
import { drawBallCheckSymbol } from './shared/checkValveSymbol';

export const CHECK_VALVE_TYPE = 'checkValve';

// Base (pre-scale) housing geometry, ported from the original app - only used here to place the
// ball-check glyph and the two ports around it. SCALE shrinks the whole symbol around its own
// center (BASE_CX, BASE_Y_MID) rather than toward the canvas corner, so shrinking it doesn't
// also shift it sideways.
const SCALE = 0.6;
const BASE_HUS_X = 20;
const BASE_HUS_Y = 40;
const BASE_HUS_W = 50;
const BASE_HUS_H = 50;
const BASE_CX = BASE_HUS_X + BASE_HUS_W / 2;
const BASE_Y_MID = BASE_HUS_Y + BASE_HUS_H / 2;
const BASE_PORT_R = 7;

const SVG_W = 66;
const SVG_H = 100;
const GX = -12;
const GY = -15;

function sx(x: number): number {
  return BASE_CX + (x - BASE_CX) * SCALE;
}
function sy(y: number): number {
  return BASE_Y_MID + (y - BASE_Y_MID) * SCALE;
}

export function createCheckValve(compLayer: HTMLElement, x: number, y: number): Component {
  const cx = sx(BASE_CX);
  const cy = sy(BASE_Y_MID);
  const portR = BASE_PORT_R * SCALE;
  const stroke = 3 * SCALE;

  const OUT = { cx, cy: sy(BASE_HUS_Y - 10) };
  const IN = { cx, cy: sy(BASE_HUS_Y + BASE_HUS_H + 10) };

  const innerHus = {
    x: sx(BASE_HUS_X),
    y: sy(BASE_HUS_Y),
    w: BASE_HUS_W * SCALE,
    h: BASE_HUS_H * SCALE,
  };

  const shell = buildComponentShell(
    compLayer,
    CHECK_VALVE_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    'Check valve',
    { x: GX + innerHus.x, y: GY + innerHus.y, w: innerHus.w, h: innerHus.h },
  );
  const g = createSvgEl('g', { transform: `translate(${GX},${GY})` });

  // No housing box around the ball/seat, matching the original app's check valve exactly - it's
  // just the ball-and-seat symbol floating between its two lead-in lines, unenclosed. IN is
  // below, OUT is above, so dir 1 (OUT is the "up"/-y direction in this vertical orientation).
  const glyph = drawBallCheckSymbol(g, cx, cy, 'vertical', 1, SCALE);

  // These lead-in lines reach all the way from each port to the ball-and-seat shape itself (the
  // circle's edge on top, the seat's tip on the bottom) rather than stopping partway - both so a
  // connected port's own hidden circle never leaves a visible gap, and so there's no blank space
  // between the port and the symbol now that there's no housing box to visually bridge it.
  g.appendChild(
    createSvgEl('line', {
      x1: OUT.cx,
      y1: OUT.cy,
      x2: glyph.outPoint.x,
      y2: glyph.outPoint.y,
      stroke: '#111',
      'stroke-width': stroke,
    }),
  );
  g.appendChild(
    createSvgEl('line', {
      x1: IN.cx,
      y1: glyph.inPoint.y,
      x2: IN.cx,
      y2: IN.cy,
      stroke: '#111',
      'stroke-width': stroke,
    }),
  );
  shell.svg.appendChild(g);

  const ports = {
    IN: createPort(g, 'IN', IN.cx, IN.cy, 'V', { radius: portR }),
    OUT: createPort(g, 'OUT', OUT.cx, OUT.cy, 'V', { radius: portR }),
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
      return { showName: shell.getNameVisible(), customName: shell.getCustomName() };
    },
    restore(data: Record<string, unknown>): void {
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
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
