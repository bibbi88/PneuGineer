import type { Component, FlowVisualContext, PortConnection, PortKey } from '../core/types';
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

// Roughly 0.85x the original reference-derived numbers (~25% bigger than the previous 0.7x size,
// per request) - a port's offset from the component's own center is `portX - localW/2` (x) and
// `localH/2 - portMargin` (y), independent of OX/OY, so grid alignment (see src/core/grid.ts)
// only constrains portX/localW and portMargin/localH, not a single global scale factor: portX and
// portMargin are nudged off the pure 0.85x values (32.3 and 6.8) to the nearest values landing
// those two offsets on a multiple of 10, while branchX/decorScale/decorOffsetY stay at their
// natural 0.85x proportions (branchX has no grid constraint of its own, and decorOffsetX is what
// keeps the throttle circle centered on branchX, so it's derived from branchX rather than portX).
export const ONE_WAY_FLOW_DEFAULT_GEOMETRY: OneWayFlowGeometry = {
  localW: 100,
  localH: 80,
  portX: 30,
  branchX: 74,
  portMargin: 10,
  decorScale: 1.7,
  decorOffsetX: -0.8,
  decorOffsetY: -34,
};

const OX = 7;
const OY = 7;
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
): {
  bottomY: number;
  topY: number;
  portX: number;
  throttleCircle: SVGEllipseElement;
  /** The check valve's own straight path - live while flow takes the direct IN->OUT route. */
  mainPath: SVGLineElement;
  /** The throttle's offset path (the three segments jogging out to branchX and back) - live
   * while flow instead takes the slower, throttled OUT->IN route. */
  branchPath: SVGLineElement[];
} {
  const bottomY = geo.localH - geo.portMargin;
  const topY = geo.portMargin;
  const circleLocalCx = 44;
  const circleLocalCy = 41;
  const circleLocalR = 4;

  // The two plain paths, IN->OUT: the check valve's own line straight up, and the throttle's
  // line jogging out to branchX and back up around it - both meeting the ports directly, same
  // as the reference's port dots being the split/rejoin points themselves. Drawn as one
  // continuous line rather than leaving a gap for the throttle circle - the circle (drawn
  // later, below, with an opaque fill) covers whatever line is directly behind it at its own
  // current position instead, so the line never shows through/behind it even while it's
  // animating (a gap sized to the circle's *rest* position would otherwise uncover a sliver of
  // line the moment the circle nudges away from it).
  const mainPath = line(geo.portX, bottomY, geo.portX, topY);
  mainPath.classList.add('owfvFlowPath');
  g.appendChild(mainPath);

  const branchPath = [
    line(geo.portX, bottomY, geo.branchX, bottomY),
    line(geo.branchX, bottomY, geo.branchX, topY),
    line(geo.branchX, topY, geo.portX, topY),
  ];
  for (const seg of branchPath) seg.classList.add('owfvFlowPath');
  g.append(...branchPath);

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
    // Opaque (not "none") so it actually covers the continuous line behind it wherever it
    // currently sits, rather than needing a gap cut into that line to match.
    fill: '#fff',
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

  return { bottomY, topY, portX: geo.portX, throttleCircle, mainPath, branchPath };
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
  const { bottomY, topY, portX, throttleCircle, mainPath, branchPath } =
    drawOneWayFlowControlValveBody(g, geo);
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

    // Purely a visual cue (nudges the throttle's circle glyph up a touch, and highlights
    // whichever of the two parallel paths air is actually taking - see .flowThrottleCircle and
    // .owfvFlowPath in app.css). This can't be based on IN/OUT's own isPressurized or
    // isExhausting: this valve's own edge is undirected (conducts both ways, just at different
    // rates), so the flood-fills behind both of those always reach IN and OUT together - neither
    // boolean alone can say which side actually has the supply (or the open vent) behind it. The
    // distance variants can: whichever port is fewer hops from a live source is the one air is
    // entering from, so IN closer means free flow through the check valve (IN->OUT), OUT closer
    // means throttled flow the other way (OUT->IN) - the check valve blocks that direction, so
    // the throttle is the only path left. Same idea for the exhaust side (e.g. the realistic
    // "meter-out" wiring, this valve's OUT tied straight to a cylinder's own exhaust): a merely-
    // pressurized-but-static source distance shouldn't win over air that's actually mid-flight to
    // atmosphere right now, so exhaust distance is checked first and source distance is only the
    // fallback for when nothing is currently venting through here at all.
    updateFlowVisual(ctx: FlowVisualContext): void {
      const inExhaust = ctx.exhaustDistance('IN');
      const outExhaust = ctx.exhaustDistance('OUT');
      const inSource = ctx.sourceDistance('IN');
      const outSource = ctx.sourceDistance('OUT');

      let forward = false; // IN -> OUT, free through the check valve
      let reverse = false; // OUT -> IN, throttled

      if (Number.isFinite(Math.min(inExhaust, outExhaust)) && inExhaust !== outExhaust) {
        forward = inExhaust < outExhaust;
        reverse = outExhaust < inExhaust;
      } else if (Number.isFinite(Math.min(inSource, outSource)) && inSource !== outSource) {
        forward = inSource < outSource;
        reverse = outSource < inSource;
      }

      throttleCircle.classList.toggle('flowing', forward);
      mainPath.classList.toggle('owfvFlowPath--pressurized', forward);
      for (const seg of branchPath) seg.classList.toggle('owfvFlowPath--exhausting', reverse);
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
      mainPath.classList.remove('owfvFlowPath--pressurized');
      for (const seg of branchPath) seg.classList.remove('owfvFlowPath--exhausting');
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
