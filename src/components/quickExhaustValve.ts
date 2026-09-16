import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createLabeledPort, createSvgEl } from './shared/svgHelpers';

export const QUICK_EXHAUST_VALVE_TYPE = 'quickExhaustValve';

export interface QuickExhaustValveGeometry {
  localW: number;
  localH: number;
  ox: number;
  oy: number;
  svgW: number;
  svgH: number;
  /** Margin from the local box edge to the body rect. */
  bodyMargin: number;
}

// svgH (60, not the "natural" 61) and bodyMargin (10, not 8) are both chosen so ports 1/2/3
// land exactly on the 10px grid relative to this canvas's own center - an odd svgH alone
// leaves every port a permanent half-pixel off - see src/core/grid.ts.
export const QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY: QuickExhaustValveGeometry = {
  localW: 60,
  localH: 40,
  ox: 22,
  oy: 0,
  svgW: 104,
  svgH: 60,
  bodyMargin: 10,
};

export function drawQuickExhaustValveBody(
  g: SVGElement,
  geo: QuickExhaustValveGeometry,
): {
  '1': { cx: number; cy: number };
  '2': { cx: number; cy: number };
  '3': { cx: number; cy: number };
} {
  const m = geo.bodyMargin;
  g.appendChild(
    createSvgEl('rect', {
      x: m,
      y: m,
      width: geo.localW - m * 2,
      height: geo.localH - m * 2,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  return {
    '1': { cx: geo.localW / 2, cy: geo.localH - m },
    '2': { cx: geo.localW - m, cy: geo.localH / 2 },
    '3': { cx: m, cy: geo.localH / 2 },
  };
}

/**
 * Self-piloted by its own supply port: when port 1 is pressurized it passes 1->2 through to the
 * cylinder; the instant port 1 drops, it opens a dedicated one-way vent 2->3 so the cylinder can
 * exhaust locally through the valve's own port 3 instead of back through the whole supply line.
 */
export function createQuickExhaustValve(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = QUICK_EXHAUST_VALVE_DEFAULT_GEOMETRY;
  const shell = buildComponentShell(
    compLayer,
    QUICK_EXHAUST_VALVE_TYPE,
    x,
    y,
    geo.svgW,
    geo.svgH,
    'Quick-exhaust valve',
    {
      x: geo.ox + geo.bodyMargin,
      y: geo.oy + geo.bodyMargin,
      w: geo.localW - geo.bodyMargin * 2,
      h: geo.localH - geo.bodyMargin * 2,
    },
  );

  const g = createSvgEl('g', { transform: `translate(${geo.ox},${geo.oy})` });
  const p = drawQuickExhaustValveBody(g, geo);
  shell.svg.appendChild(g);

  const ports = {
    '1': createLabeledPort(g, '1', p['1'].cx, p['1'].cy, 'V', 'below'),
    '2': createLabeledPort(g, '2', p['2'].cx, p['2'].cy, 'H', 'right'),
    '3': createLabeledPort(g, '3', p['3'].cx, p['3'].cy, 'H', 'left'),
  };

  const comp: Component = {
    id: uid(),
    type: QUICK_EXHAUST_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: geo.svgW,
    svgH: geo.svgH,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(ctx: ConductivityContext): PortConnection[] {
      return ctx.isPressurized('1') ? [{ a: '1', b: '2' }] : [{ a: '2', b: '3', directed: true }];
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
