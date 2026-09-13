import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createLabeledPort, createSvgEl } from './shared/svgHelpers';

export const QUICK_EXHAUST_VALVE_TYPE = 'quickExhaustValve';

// Local layout box for the body+port geometry below; OX/OY place it inside the padded outer
// canvas (SVG_W/SVG_H), which must be larger to fit the port number labels that spill outside it.
const LOCAL_W = 60;
const LOCAL_H = 40;
const OX = 22;
const OY = 0;
const SVG_W = 104;
const SVG_H = 61;

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

  const g = createSvgEl('g', { transform: `translate(${OX},${OY})` });

  const body = createSvgEl('rect', {
    x: 8,
    y: 8,
    width: LOCAL_W - 16,
    height: LOCAL_H - 16,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  g.appendChild(body);
  shell.svg.appendChild(g);

  const ports = {
    '1': createLabeledPort(g, '1', LOCAL_W / 2, LOCAL_H - 8, 'V', 'below'),
    '2': createLabeledPort(g, '2', LOCAL_W - 8, LOCAL_H / 2, 'H', 'right'),
    '3': createLabeledPort(g, '3', 8, LOCAL_H / 2, 'H', 'left'),
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
