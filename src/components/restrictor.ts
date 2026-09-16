import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createLabeledPort } from './shared/svgHelpers';

export const RESTRICTOR_TYPE = 'restrictor';

export interface RestrictorGeometry {
  svgW: number;
  svgH: number;
  gx: number;
  gy: number;
  husX: number;
  husY: number;
  husW: number;
  husH: number;
  /** Distance from each port to the housing edge. */
  portLead: number;
}

export const RESTRICTOR_DEFAULT_GEOMETRY: RestrictorGeometry = {
  svgW: 76,
  svgH: 145,
  gx: -22,
  gy: -6,
  husX: 30,
  husY: 50,
  husW: 60,
  husH: 60,
  portLead: 18,
};

export function drawRestrictorBody(
  g: SVGElement,
  geo: RestrictorGeometry,
): { in: { cx: number; cy: number }; out: { cx: number; cy: number } } {
  g.appendChild(
    createSvgEl('rect', {
      x: geo.husX,
      y: geo.husY,
      width: geo.husW,
      height: geo.husH,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  const x1 = geo.husX + 6;
  const x2 = geo.husX + geo.husW - 6;
  const yC = geo.husY + geo.husH / 2;
  g.appendChild(
    createSvgEl('path', {
      d: `M ${x1} ${yC + 8} L ${x1 + 16} ${yC} L ${x1} ${yC - 8} M ${x2} ${yC + 8} L ${x2 - 16} ${yC} L ${x2} ${yC - 8}`,
      stroke: '#111',
      fill: 'none',
      'stroke-width': 2,
    }),
  );

  const IN = { cx: geo.husX + geo.husW / 2, cy: geo.husY + geo.husH + geo.portLead };
  const OUT = { cx: geo.husX + geo.husW / 2, cy: geo.husY - geo.portLead };
  // These lead-in lines must reach the exact port center (not just close to it), since a
  // connected port's own circle is hidden - any gap between the line and the port position
  // would otherwise show up as a visible blank break in the wire.
  g.appendChild(
    createSvgEl('line', {
      x1: IN.cx,
      y1: geo.husY + geo.husH,
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
      y2: geo.husY,
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  return { in: IN, out: OUT };
}

const DEFAULT_FLOW_PCT = 50;

export function createRestrictor(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = RESTRICTOR_DEFAULT_GEOMETRY;
  const shell = buildComponentShell(
    compLayer,
    RESTRICTOR_TYPE,
    x,
    y,
    geo.svgW,
    geo.svgH,
    'Restrictor',
    { x: geo.gx + geo.husX, y: geo.gy + geo.husY, w: geo.husW, h: geo.husH },
  );
  const g = createSvgEl('g', { transform: `translate(${geo.gx},${geo.gy})` });
  const { in: IN, out: OUT } = drawRestrictorBody(g, geo);
  shell.svg.appendChild(g);

  const ports = {
    IN: createLabeledPort(g, 'IN', IN.cx, IN.cy, 'V', 'below'),
    OUT: createLabeledPort(g, 'OUT', OUT.cx, OUT.cy, 'V', 'above'),
  };

  let flowPct = DEFAULT_FLOW_PCT;

  function updateLabel(): void {
    shell.setDefaultName(`Restrictor (${Math.round(flowPct)}%)`);
  }
  updateLabel();

  const comp: Component = {
    id: uid(),
    type: RESTRICTOR_TYPE,
    el: shell.el,
    x,
    y,
    svgW: geo.svgW,
    svgH: geo.svgH,
    gx: geo.gx,
    gy: geo.gy,
    ports,

    conductivityRule(): PortConnection[] {
      return [{ a: 'IN', b: 'OUT' }];
    },

    flowMultiplier(): number {
      return flowPct / 100;
    },

    snapshot(): Record<string, unknown> {
      return { flowPct, showName: shell.getNameVisible(), customName: shell.getCustomName() };
    },
    restore(data: Record<string, unknown>): void {
      flowPct = data.flowPct as number;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
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
