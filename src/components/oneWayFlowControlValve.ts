import type { Component, PortConnection, PortKey } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createLabeledPort, createSvgEl } from './shared/svgHelpers';

export const ONE_WAY_FLOW_CONTROL_VALVE_TYPE = 'oneWayFlowControlValve';

// Local layout box for the poppet+throttle geometry below; OX/OY place it inside the padded
// outer canvas (SVG_W/SVG_H), which must be larger to fit the port number labels below it.
const LOCAL_W = 55;
const LOCAL_H = 26;
const OX = 14;
const OY = 4;
const SVG_W = 83;
const SVG_H = 46;
const DEFAULT_FLOW_PCT = 50;

/** Check valve + restrictor combined: free flow IN->OUT, throttled (flowPct) flow OUT->IN. */
export function createOneWayFlowControlValve(
  compLayer: HTMLElement,
  x: number,
  y: number,
): Component {
  const shell = buildComponentShell(
    compLayer,
    ONE_WAY_FLOW_CONTROL_VALVE_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    'One-way Flow',
  );

  const g = createSvgEl('g', { transform: `translate(${OX},${OY})` });

  const line = createSvgEl('line', {
    x1: 0,
    y1: LOCAL_H / 2,
    x2: LOCAL_W,
    y2: LOCAL_H / 2,
    stroke: '#111',
    'stroke-width': 2,
  });
  g.appendChild(line);

  const poppet = createSvgEl('polygon', {
    points: `${LOCAL_W / 2 - 9},${LOCAL_H / 2 - 8} ${LOCAL_W / 2 + 9},${LOCAL_H / 2} ${LOCAL_W / 2 - 9},${LOCAL_H / 2 + 8}`,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  g.appendChild(poppet);

  const throttleLine = createSvgEl('line', {
    x1: LOCAL_W / 2 + 9,
    y1: LOCAL_H / 2 - 9,
    x2: LOCAL_W / 2 + 9,
    y2: LOCAL_H / 2 + 9,
    stroke: '#111',
    'stroke-width': 2,
  });
  g.appendChild(throttleLine);
  shell.svg.appendChild(g);

  const ports = {
    IN: createLabeledPort(g, 'IN', 0, LOCAL_H / 2, 'H', 'below'),
    OUT: createLabeledPort(g, 'OUT', LOCAL_W, LOCAL_H / 2, 'H', 'below'),
  };

  let flowPct = DEFAULT_FLOW_PCT;

  const comp: Component = {
    id: uid(),
    type: ONE_WAY_FLOW_CONTROL_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return [{ a: 'IN', b: 'OUT' }];
    },

    flowMultiplier(fromPort: PortKey): number {
      return fromPort === 'IN' ? 1 : flowPct / 100;
    },

    snapshot(): Record<string, unknown> {
      return { flowPct };
    },
    restore(data: Record<string, unknown>): void {
      flowPct = data.flowPct as number;
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
