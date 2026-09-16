import type { Component, PortConnection, PortKey } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createLabeledPort, createSvgEl } from './shared/svgHelpers';

export const ONE_WAY_FLOW_CONTROL_VALVE_TYPE = 'oneWayFlowControlValve';

// Two parallel paths between the same two ports, housing-less (no drawn outline - just the two
// lines and their fittings, as on the reference icon this was redrawn from). The reference was
// drawn vertically (IN at the bottom, OUT at the top, the throttle branch offset to one side);
// rather than re-deriving each decorative shape's coordinates by hand for our horizontal
// IN-left/OUT-right layout - which previously let the check valve's arrow and the throttle's
// circle/chevron drift out of the proportion they have in the source - the decorative glyphs
// below are the reference's own path data, verbatim, reoriented by a single rigid
// rotate-and-uniform-scale transform. That guarantees every relationship in the source - in
// particular how far the chevron's tip pokes out past the circle - survives the reorientation
// exactly. Only the plain straight lines (the two ports-to-ports paths) are drawn fresh, in
// native horizontal coordinates, to avoid inheriting the reference's long lead-line stubs.
//
// All of the tunable numbers live in `OneWayFlowGeometry` / `ONE_WAY_FLOW_DEFAULT_GEOMETRY`
// below, and `drawOneWayFlowControlValveBody` (the only place that actually draws) takes them
// as a parameter rather than reading module constants directly - both so the real component
// and the symbol-lab dev tool (tools/symbol-lab.html) render from the exact same code, and so
// tweaking a shape never means hand-copying numbers between two divergent implementations.
export interface OneWayFlowGeometry {
  localW: number;
  localH: number;
  /** Height of the check valve's own line (the upper of the two parallel paths). */
  portY: number;
  /** Height of the throttle's line (the lower path, reached by a jog down from portY). */
  branchY: number;
  /** Margin from each side of localW to the IN/OUT ports (symmetric). */
  leftX: number;
  /** Uniform scale applied to the reference icon's decorative glyphs (lens, arrow, circle,
   * chevron) - keeping it uniform (rather than separate x/y factors) is what keeps the
   * throttle's circle a circle instead of stretching it into an ellipse. */
  decorScale: number;
  /** Translation of the decorative glyphs after rotation+scale - nudge these to reposition
   * the lens/arrow/circle/chevron without moving the structural lines or ports. */
  decorOffsetX: number;
  decorOffsetY: number;
}

export const ONE_WAY_FLOW_DEFAULT_GEOMETRY: OneWayFlowGeometry = {
  localW: 96,
  localH: 116,
  portY: 34,
  branchY: 90,
  leftX: 8,
  decorScale: 2,
  decorOffsetX: 136,
  decorOffsetY: 2,
};

const OX = 8;
const OY = 8;
const DEFAULT_FLOW_PCT = 50;

function line(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
  return createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': 2 });
}

/** Draws the body (structural lines + decorative glyphs) into `g`, and returns the port
 * positions that resulted so the caller can place ports/labels there. Pure with respect to
 * `g`'s own contents - safe to call repeatedly against a cleared `g` for a live preview. */
export function drawOneWayFlowControlValveBody(
  g: SVGElement,
  geo: OneWayFlowGeometry,
): { leftX: number; rightX: number; portY: number } {
  const rightX = geo.localW - geo.leftX;

  // The two plain paths, IN->OUT: the check valve's own line straight across, and the
  // throttle's line looping down to branchY and back up around it - both meeting the ports
  // directly, same as the reference's port dots being the split/rejoin points themselves.
  g.appendChild(line(geo.leftX, geo.portY, rightX, geo.portY));
  g.append(
    line(geo.leftX, geo.portY, geo.leftX, geo.branchY),
    line(geo.leftX, geo.branchY, rightX, geo.branchY),
    line(rightX, geo.branchY, rightX, geo.portY),
  );

  // Decorative glyphs lifted verbatim from the reference icon (still in its own vertical
  // coordinates - the matrix below is what lands them on the lines drawn above): the check
  // valve's ball-and-seat lens plus its flow-direction arrow, and the throttle's circle with
  // the chevron tip poking out through it. `matrix(0,S,-S,0,e,f)` is a rigid 90-degree turn
  // plus uniform scale S, then translate by (e,f) - never a,d (which would shear the shapes).
  const decorTransform = `matrix(0,${geo.decorScale},${-geo.decorScale},0,${geo.decorOffsetX},${geo.decorOffsetY})`;
  const decor = createSvgEl('g', { transform: decorTransform });
  decor.append(
    createSvgEl('path', {
      d: 'M8,32c5.02,7.21,5.02,16.79,0,24',
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1,
    }),
    createSvgEl('path', {
      d: 'M24,56c-5.02,-7.21,-5.02,-16.79,0,-24',
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1,
    }),
    createSvgEl('line', { x1: 4, y1: 48, x2: 25, y2: 39.8, stroke: '#111', 'stroke-width': 1 }),
    createSvgEl('polygon', { points: '31,37.4 24.5,37.56 26.1,41.34', fill: '#111' }),
    createSvgEl('ellipse', {
      cx: 44,
      cy: 41,
      rx: 4,
      ry: 4,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1,
    }),
    createSvgEl('path', {
      d: 'M36,40l8,8l8-8',
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1,
    }),
  );
  g.appendChild(decor);

  return { leftX: geo.leftX, rightX, portY: geo.portY };
}

/** Check valve + adjustable throttle in parallel: free flow IN->OUT through the check valve's
 * own path, throttled (flowPct) flow OUT->IN through the throttle's path. */
export function createOneWayFlowControlValve(
  compLayer: HTMLElement,
  x: number,
  y: number,
): Component {
  const geo = ONE_WAY_FLOW_DEFAULT_GEOMETRY;
  const svgW = geo.localW + OX * 2;
  const svgH = geo.localH + OY * 2;

  const shell = buildComponentShell(
    compLayer,
    ONE_WAY_FLOW_CONTROL_VALVE_TYPE,
    x,
    y,
    svgW,
    svgH,
    'One-way flow control',
    { x: OX, y: OY, w: geo.localW, h: geo.localH },
  );

  const g = createSvgEl('g', { transform: `translate(${OX},${OY})` });
  const { leftX, rightX, portY } = drawOneWayFlowControlValveBody(g, geo);
  shell.svg.appendChild(g);

  const ports = {
    IN: createLabeledPort(g, 'IN', leftX, portY, 'H', 'above'),
    OUT: createLabeledPort(g, 'OUT', rightX, portY, 'H', 'above'),
  };

  let flowPct = DEFAULT_FLOW_PCT;

  const comp: Component = {
    id: uid(),
    type: ONE_WAY_FLOW_CONTROL_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW,
    svgH,
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
