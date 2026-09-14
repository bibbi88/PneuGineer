import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createLabeledPort } from './shared/svgHelpers';

export const RESTRICTOR_TYPE = 'restrictor';

const SVG_W = 76;
const SVG_H = 145;
const GX = -22;
const GY = -6;
const HUS_X = 30;
const HUS_Y = 50;
const HUS_W = 60;
const HUS_H = 60;
const DEFAULT_FLOW_PCT = 50;

export function createRestrictor(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, RESTRICTOR_TYPE, x, y, SVG_W, SVG_H, 'Restrictor', {
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
      'stroke-width': 2,
    }),
  );

  const x1 = HUS_X + 6;
  const x2 = HUS_X + HUS_W - 6;
  const yC = HUS_Y + HUS_H / 2;
  g.appendChild(
    createSvgEl('path', {
      d: `M ${x1} ${yC + 8} L ${x1 + 16} ${yC} L ${x1} ${yC - 8} M ${x2} ${yC + 8} L ${x2 - 16} ${yC} L ${x2} ${yC - 8}`,
      stroke: '#111',
      fill: 'none',
      'stroke-width': 2,
    }),
  );

  const IN = { cx: HUS_X + HUS_W / 2, cy: HUS_Y + HUS_H + 18 };
  const OUT = { cx: HUS_X + HUS_W / 2, cy: HUS_Y - 18 };
  // These lead-in lines must reach the exact port center (not just close to it), since a
  // connected port's own circle is hidden - any gap between the line and the port position
  // would otherwise show up as a visible blank break in the wire.
  g.appendChild(
    createSvgEl('line', {
      x1: IN.cx,
      y1: HUS_Y + HUS_H,
      x2: IN.cx,
      y2: IN.cy,
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  g.appendChild(
    createSvgEl('line', {
      x1: OUT.cx,
      y1: OUT.cy,
      x2: OUT.cx,
      y2: HUS_Y,
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  shell.svg.appendChild(g);

  const ports = {
    IN: createLabeledPort(g, 'IN', IN.cx, IN.cy, 'V', 'below'),
    OUT: createLabeledPort(g, 'OUT', OUT.cx, OUT.cy, 'V', 'above'),
  };

  let flowPct = DEFAULT_FLOW_PCT;

  function updateLabel(): void {
    shell.labelEl.textContent = `Restrictor (${Math.round(flowPct)}%)`;
  }
  updateLabel();

  const comp: Component = {
    id: uid(),
    type: RESTRICTOR_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: GX,
    gy: GY,
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
      updateLabel();
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
