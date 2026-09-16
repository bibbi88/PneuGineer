import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';
import { drawBallCheckSymbol } from './shared/checkValveSymbol';

export const CHECK_VALVE_TYPE = 'checkValve';

export interface CheckValveGeometry {
  svgW: number;
  svgH: number;
  gx: number;
  gy: number;
  /** Uniform scale applied to the shared ball-check glyph and the housing box it's centered on. */
  scale: number;
  /** Base (pre-scale) housing box the glyph is placed around. */
  baseHusX: number;
  baseHusY: number;
  baseHusW: number;
  baseHusH: number;
  basePortR: number;
  /** Distance (pre-scale) from the housing edge to each port. */
  basePortLead: number;
}

export const CHECK_VALVE_DEFAULT_GEOMETRY: CheckValveGeometry = {
  svgW: 66,
  svgH: 100,
  gx: -12,
  gy: -15,
  scale: 0.6,
  baseHusX: 20,
  baseHusY: 40,
  baseHusW: 50,
  baseHusH: 50,
  basePortR: 7,
  // 25/3 rather than the "natural" 10: after the 0.6 scale is applied this lands IN/OUT exactly
  // 20px (a grid multiple) above/below this canvas's own center, instead of ~21px - see
  // src/core/grid.ts. A plain integer pre-scale value can't hit an exact post-scale multiple of
  // 10 without a much bigger (9px+) visual change, so this one constant is intentionally a
  // fraction rather than rounded.
  basePortLead: 25 / 3,
};

export function drawCheckValveBody(
  g: SVGElement,
  geo: CheckValveGeometry,
): { in: { cx: number; cy: number }; out: { cx: number; cy: number }; portR: number } {
  const baseCx = geo.baseHusX + geo.baseHusW / 2;
  const baseYMid = geo.baseHusY + geo.baseHusH / 2;
  const sx = (v: number): number => baseCx + (v - baseCx) * geo.scale;
  const sy = (v: number): number => baseYMid + (v - baseYMid) * geo.scale;

  const cx = sx(baseCx);
  const cy = sy(baseYMid);
  const portR = geo.basePortR * geo.scale;
  const stroke = 3 * geo.scale;

  const OUT = { cx, cy: sy(geo.baseHusY - geo.basePortLead) };
  const IN = { cx, cy: sy(geo.baseHusY + geo.baseHusH + geo.basePortLead) };

  // No housing box around the ball/seat, matching the original app's check valve exactly - it's
  // just the ball-and-seat symbol floating between its two lead-in lines, unenclosed. IN is
  // below, OUT is above, so dir 1 (OUT is the "up"/-y direction in this vertical orientation).
  const glyph = drawBallCheckSymbol(g, cx, cy, 'vertical', 1, geo.scale);

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

  return { in: IN, out: OUT, portR };
}

export function createCheckValve(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = CHECK_VALVE_DEFAULT_GEOMETRY;
  const baseCx = geo.baseHusX + geo.baseHusW / 2;
  const baseYMid = geo.baseHusY + geo.baseHusH / 2;
  const innerHus = {
    x: baseCx + (geo.baseHusX - baseCx) * geo.scale,
    y: baseYMid + (geo.baseHusY - baseYMid) * geo.scale,
    w: geo.baseHusW * geo.scale,
    h: geo.baseHusH * geo.scale,
  };

  const shell = buildComponentShell(
    compLayer,
    CHECK_VALVE_TYPE,
    x,
    y,
    geo.svgW,
    geo.svgH,
    'Check valve',
    { x: geo.gx + innerHus.x, y: geo.gy + innerHus.y, w: innerHus.w, h: innerHus.h },
  );
  const g = createSvgEl('g', { transform: `translate(${geo.gx},${geo.gy})` });
  const { in: IN, out: OUT, portR } = drawCheckValveBody(g, geo);
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
    svgW: geo.svgW,
    svgH: geo.svgH,
    gx: geo.gx,
    gy: geo.gy,
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
