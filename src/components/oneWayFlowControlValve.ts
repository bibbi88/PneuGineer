import type { Component, PortConnection, PortKey } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const ONE_WAY_FLOW_CONTROL_VALVE_TYPE = 'oneWayFlowControlValve';

const SVG_W = 55;
const SVG_H = 26;
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

  const line = createSvgEl('line', {
    x1: 0,
    y1: SVG_H / 2,
    x2: SVG_W,
    y2: SVG_H / 2,
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(line);

  const poppet = createSvgEl('polygon', {
    points: `${SVG_W / 2 - 9},${SVG_H / 2 - 8} ${SVG_W / 2 + 9},${SVG_H / 2} ${SVG_W / 2 - 9},${SVG_H / 2 + 8}`,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(poppet);

  const throttleLine = createSvgEl('line', {
    x1: SVG_W / 2 + 9,
    y1: SVG_H / 2 - 9,
    x2: SVG_W / 2 + 9,
    y2: SVG_H / 2 + 9,
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(throttleLine);

  const ports = {
    IN: createPort(shell.svg, 'IN', 0, SVG_H / 2, 'H'),
    OUT: createPort(shell.svg, 'OUT', SVG_W, SVG_H / 2, 'H'),
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
