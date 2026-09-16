import type { Component, PortConnection, PortKey, SimStepContext } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const ONE_WAY_FLOW_CONTROL_VALVE_TYPE = 'oneWayFlowControlValve';

// Two parallel paths between the same two ports, housing-less (no drawn outline - just the two
// lines and their fittings, as on the reference icon this was redrawn from). The reference - and
// this component, rotated 90° CCW from an earlier horizontal IN-left/OUT-right layout to match
// it - is drawn vertically: IN at the bottom, OUT at the top, the throttle branch offset to one
// side. Because this orientation matches the reference directly, the decorative glyphs below are
// its own path data, verbatim, just scaled and translated into place (no rotation component
// needed in that transform) - so every relationship in the source, in particular how far the
// chevron's tip pokes out past the circle, survives untouched. Only the plain straight lines (the
// two ports-to-ports paths) are drawn fresh, in native coordinates, to avoid inheriting the
// reference's long lead-line stubs.
//
// All of the tunable numbers live in `OneWayFlowGeometry` / `ONE_WAY_FLOW_DEFAULT_GEOMETRY`
// below, and `drawOneWayFlowControlValveBody` (the only place that actually draws) takes them
// as a parameter rather than reading module constants directly - both so the real component
// and the symbol-lab dev tool (tools/symbol-lab.html) render from the exact same code, and so
// tweaking a shape never means hand-copying numbers between two divergent implementations.
export interface OneWayFlowGeometry {
  localW: number;
  localH: number;
  /** x of the check valve's own line (the more direct of the two parallel paths). */
  portX: number;
  /** x of the throttle's line (the offset path, reached by a jog sideways from portX). */
  branchX: number;
  /** Margin from the top/bottom edge of localH to the IN/OUT ports (symmetric) - IN sits near
   * the bottom, OUT near the top. */
  portMargin: number;
  /** Uniform scale applied to the reference icon's decorative glyphs (lens, arrow, circle,
   * chevron) - keeping it uniform (rather than separate x/y factors) is what keeps the
   * throttle's circle a circle instead of stretching it into an ellipse. */
  decorScale: number;
  /** Translation of the decorative glyphs after scaling - nudge these to reposition the
   * lens/arrow/circle/chevron without moving the structural lines or ports. */
  decorOffsetX: number;
  decorOffsetY: number;
}

export const ONE_WAY_FLOW_DEFAULT_GEOMETRY: OneWayFlowGeometry = {
  localW: 116,
  localH: 96,
  portX: 38,
  branchX: 90,
  portMargin: 8,
  decorScale: 2,
  decorOffsetX: 2,
  decorOffsetY: -40,
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
): { bottomY: number; topY: number; portX: number; throttleCircle: SVGEllipseElement } {
  const bottomY = geo.localH - geo.portMargin;
  const topY = geo.portMargin;

  // Where the throttle circle (drawn below, in the decor group's own coordinates) actually
  // lands once scaled/translated into `g`'s coordinate space - so the branch line drawn next
  // can leave a gap there instead of running on behind it.
  const circleLocalCx = 44;
  const circleLocalCy = 41;
  const circleLocalR = 4;
  const circleCy = geo.decorScale * circleLocalCy + geo.decorOffsetY;
  const circleR = geo.decorScale * circleLocalR;

  // The two plain paths, IN->OUT: the check valve's own line straight up, and the throttle's
  // line jogging out to branchX and back up around it - both meeting the ports directly, same
  // as the reference's port dots being the split/rejoin points themselves. The branch line's
  // run past the throttle circle is split in two around it (rather than one line the circle
  // just gets drawn on top of) so nothing shows through/behind the circle.
  g.appendChild(line(geo.portX, bottomY, geo.portX, topY));
  g.append(
    line(geo.portX, bottomY, geo.branchX, bottomY),
    line(geo.branchX, bottomY, geo.branchX, circleCy + circleR),
    line(geo.branchX, circleCy - circleR, geo.branchX, topY),
    line(geo.branchX, topY, geo.portX, topY),
  );

  // Decorative glyphs lifted verbatim from the reference icon: the check valve's ball-and-seat
  // lens plus its flow-direction arrow, and the throttle's circle with the chevron tip poking
  // out through it. Reference and this component share the same vertical orientation, so this
  // is a plain scale S then translate by (e,f) - no rotation component needed.
  const decorTransform = `matrix(${geo.decorScale},0,0,${geo.decorScale},${geo.decorOffsetX},${geo.decorOffsetY})`;
  const decor = createSvgEl('g', { transform: decorTransform });
  const throttleCircle = createSvgEl('ellipse', {
    class: 'flowThrottleCircle',
    cx: circleLocalCx,
    cy: circleLocalCy,
    rx: circleLocalR,
    ry: circleLocalR,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 1,
  });
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
    throttleCircle,
    createSvgEl('path', {
      d: 'M36,40l8,8l8-8',
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1,
    }),
  );
  g.appendChild(decor);

  return { bottomY, topY, portX: geo.portX, throttleCircle };
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
  const { bottomY, topY, portX, throttleCircle } = drawOneWayFlowControlValveBody(g, geo);
  shell.svg.appendChild(g);

  const ports = {
    IN: createPort(g, 'IN', portX, bottomY, 'V'),
    OUT: createPort(g, 'OUT', portX, topY, 'V'),
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

    // Purely a visual cue (nudges the throttle's circle glyph up a touch via CSS, see
    // .flowThrottleCircle.flowing) - the check valve's own path conducts unconditionally
    // whenever IN is pressurized, so that's the same signal this reads. A step() rather than
    // onPressureChange() deliberately, since the latter tells the engine "this may have just
    // changed my own conductivity" and forces an extra frame-graph recompute - this never does.
    step(_dt: number, ctx: SimStepContext): void {
      throttleCircle.classList.toggle('flowing', ctx.isPressurized('IN'));
    },

    snapshot(): Record<string, unknown> {
      return { flowPct, showName: shell.getNameVisible(), customName: shell.getCustomName() };
    },
    restore(data: Record<string, unknown>): void {
      flowPct = data.flowPct as number;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
    },
    reset(): void {
      throttleCircle.classList.remove('flowing');
    },

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
