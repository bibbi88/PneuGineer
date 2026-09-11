import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const QUICK_EXHAUST_VALVE_TYPE = 'quickExhaustValve';

const SVG_W = 60;
const SVG_H = 40;

/**
 * Self-piloted by its own supply port: when port 1 is pressurized it passes 1->2 through to the
 * cylinder; the instant port 1 drops, it opens a dedicated one-way vent 2->3 so the cylinder can
 * exhaust locally through the valve's own port 3 instead of back through the whole supply line.
 */
export function createQuickExhaustValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(
    compLayer,
    QUICK_EXHAUST_VALVE_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    'Quick Exh.',
  );

  const body = createSvgEl('rect', {
    x: 8,
    y: 8,
    width: SVG_W - 16,
    height: SVG_H - 16,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(body);

  const ports = {
    '1': createPort(shell.svg, '1', SVG_W / 2, SVG_H - 8, 'V'),
    '2': createPort(shell.svg, '2', SVG_W - 8, SVG_H / 2, 'H'),
    '3': createPort(shell.svg, '3', 8, SVG_H / 2, 'H'),
  };

  const comp: Component = {
    id: uid(),
    type: QUICK_EXHAUST_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(ctx: ConductivityContext): PortConnection[] {
      return ctx.isPressurized('1') ? [{ a: '1', b: '2' }] : [{ a: '2', b: '3', directed: true }];
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
