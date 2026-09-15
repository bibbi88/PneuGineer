import type { Component, PortConnection, PortKey } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createLabeledPort, createSvgEl } from './shared/svgHelpers';
import { drawBallCheckSymbol } from './shared/checkValveSymbol';

export const ONE_WAY_FLOW_CONTROL_VALVE_TYPE = 'oneWayFlowControlValve';

// A check valve (reusing the exact same ball-and-seat glyph as checkValve.ts) and an adjustable
// throttle chevron sit end-to-end on one line between the two ports, inside a solid housing -
// the ISO symbol for this component. A dashed linkage from the junction between them, bent
// outside the housing, marks the throttle as adjustable from outside.
const LOCAL_W = 80;
const LOCAL_H = 40;
const PORT_Y = LOCAL_H / 2;
const LEFT_X = 6;
const RIGHT_X = LOCAL_W - 6;
const CHECK_CX = 26;
const CHECK_SCALE = 0.6;
const CHEVRON_BACK_X = 48;
const CHEVRON_TIP_X = 58;
const CHEVRON_HALF_H = 7;

const OX = 8;
const OY = 12;
const SVG_W = LOCAL_W + OX * 2;
const SVG_H = LOCAL_H + OY + 20;
const DEFAULT_FLOW_PCT = 50;

function line(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
  return createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': 2 });
}

/** Check valve + adjustable throttle in series: free flow IN->OUT through the check valve,
 * throttled (flowPct) flow OUT->IN through the throttle. */
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
    'One-way flow control',
    { x: OX, y: OY, w: LOCAL_W, h: LOCAL_H },
  );

  const g = createSvgEl('g', { transform: `translate(${OX},${OY})` });

  g.appendChild(
    createSvgEl('rect', {
      x: 0,
      y: 0,
      width: LOCAL_W,
      height: LOCAL_H,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  const glyph = drawBallCheckSymbol(g, CHECK_CX, PORT_Y, 'horizontal', 1, CHECK_SCALE);

  g.append(
    line(LEFT_X, PORT_Y, glyph.inPoint.x, glyph.inPoint.y),
    line(glyph.outPoint.x, glyph.outPoint.y, CHEVRON_BACK_X, PORT_Y),
  );

  // The throttle: a plain ">" chevron pointing toward OUT, matching the ISO mark for a simple
  // (here, adjustable) restriction - no separate arrowhead marker needed, the chevron itself is
  // the whole symbol.
  g.appendChild(
    createSvgEl('path', {
      d: `M ${CHEVRON_BACK_X} ${PORT_Y - CHEVRON_HALF_H} L ${CHEVRON_TIP_X} ${PORT_Y} L ${CHEVRON_BACK_X} ${PORT_Y + CHEVRON_HALF_H}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  g.appendChild(line(CHEVRON_TIP_X, PORT_Y, RIGHT_X, PORT_Y));

  // Adjustability linkage: a dot where the check valve's own path meets the throttle's, a short
  // stub up to the housing edge, then a dashed diagonal (with a small flagged end) reaching
  // outside the housing - the ISO convention for "externally adjustable".
  const junctionX = (glyph.outPoint.x + CHEVRON_BACK_X) / 2;
  g.appendChild(
    createSvgEl('circle', { cx: junctionX, cy: PORT_Y, r: 2, fill: '#111', stroke: 'none' }),
  );
  g.appendChild(line(junctionX, PORT_Y, junctionX, PORT_Y - 14));
  g.appendChild(
    createSvgEl('path', {
      d: `M ${junctionX} ${PORT_Y - 14} L ${junctionX + 22} ${PORT_Y - 32} L ${junctionX + 34} ${PORT_Y - 32}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1.5,
      'stroke-dasharray': '4 3',
    }),
  );

  shell.svg.appendChild(g);

  const ports = {
    IN: createLabeledPort(g, 'IN', LEFT_X, PORT_Y, 'H', 'below'),
    OUT: createLabeledPort(g, 'OUT', RIGHT_X, PORT_Y, 'H', 'below'),
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
      return { flowPct, showName: shell.getNameVisible(), customName: shell.getCustomName() };
    },
    restore(data: Record<string, unknown>): void {
      flowPct = data.flowPct as number;
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
