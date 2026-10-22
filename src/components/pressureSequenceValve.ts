import type { Component, PortConnection, PortDef, SimStepContext } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createLabeledPort, createSvgEl } from './shared/svgHelpers';
import {
  buildSlidingValve32Body,
  SLIDING_VALVE_32_DEFAULT_GEOMETRY,
  SLIDING_VALVE_H,
  SLIDING_VALVE_OFFSET_X,
  SLIDING_VALVE_OFFSET_Y,
  SLIDING_VALVE_W,
  type SlidingValve32Geometry,
} from './shared/slidingValve32';
import { addSpringZigzag, SPRING_DEFAULT_GEOMETRY } from './shared/spring';
import { SOURCE_PRESSURE } from '../sim/constants';

export const PRESSURE_SEQUENCE_VALVE_TYPE = 'pressureSequenceValve';

/** Room added on each side of the canvas for the pilot stage drawn left of the valve - equal on
 * both sides so the canvas center (the component's position) stays over the 3/2 valve, as it is
 * for the rest of the 3/2 family. */
const PILOT_ROOM = 60;
const GEOMETRY: SlidingValve32Geometry = {
  ...SLIDING_VALVE_32_DEFAULT_GEOMETRY,
  offsetX: SLIDING_VALVE_OFFSET_X + PILOT_ROOM,
};
const SVG_W = GEOMETRY.offsetX + SLIDING_VALVE_W + 50 + PILOT_ROOM;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 34;
const DEFAULT_SET_PRESSURE = 3.0;

export interface PressureSequenceValveGeometry {
  /** x of port 12 and the pilot stage's center, relative to the valve's left wall. */
  stageX: number;
  stageHalfW: number;
  stageTop: number;
  stageBottom: number;
  /** Length of the setting spring above the pilot stage. */
  springLen: number;
  /** x of the internal supply line's run down the left, relative to the valve's left wall. */
  supplyX: number;
  /** y of the junction on port 1's line where the internal supply is taken off. */
  supplyY: number;
  /** Pilot triangle on the valve's left wall. */
  pilotBaseX: number;
  pilotHalfHeight: number;
  /** Dashed frame round the whole unit, relative to the valve body. */
  frameLeft: number;
  frameRight: number;
  frameTop: number;
  frameBottom: number;
  /** y of port 12 - level with port 1, so both sit on the same grid row. */
  portY: number;
}

export const PRESSURE_SEQUENCE_VALVE_DEFAULT_GEOMETRY: PressureSequenceValveGeometry = {
  // -62 puts port 12 on the 10px grid (130 left of the canvas center) - see src/core/grid.ts.
  stageX: -62,
  stageHalfW: 20,
  stageTop: 18,
  stageBottom: 42,
  springLen: 24,
  supplyX: -94,
  supplyY: SLIDING_VALVE_H + 4,
  pilotBaseX: -14,
  pilotHalfHeight: 6,
  frameLeft: -104,
  frameRight: 186,
  // Round the whole unit - port numbers and the exhaust included - so nothing it draws is cut
  // through by the dashes.
  frameTop: -22,
  frameBottom: SLIDING_VALVE_H + 30,
  portY: SLIDING_VALVE_H + 10,
};

function seg(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  extra: Record<string, string | number> = {},
): SVGElement {
  return createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': 2, ...extra });
}

/**
 * Draws the pilot stage, its internal supply and the frame. Port 12's signal acts on a small
 * adjustable pressure valve (the box, with its setting spring and adjustment arrow above it);
 * once that pressure reaches the setting, the stage passes air - taken internally from port 1,
 * the dashed line - on to the 3/2 valve's air pilot. Everything is static: the valve shows its
 * switched state by its cells trading places (see setSwapped) rather than sliding, so the lines
 * joining the pilot stage to port 1 and to the valve never come apart. Coordinates are relative
 * to the valve body's top-left corner.
 */
function drawPilotStage(g: SVGElement, geo: PressureSequenceValveGeometry, port1X: number): void {
  const cy = SLIDING_VALVE_H / 2;
  const left = geo.stageX - geo.stageHalfW;
  const right = geo.stageX + geo.stageHalfW;
  const dashed = { 'stroke-width': 1.5, 'stroke-dasharray': '5 3' };

  // Frame first, so everything else draws over it.
  g.appendChild(
    createSvgEl('rect', {
      x: geo.frameLeft,
      y: geo.frameTop,
      width: geo.frameRight - geo.frameLeft,
      height: geo.frameBottom - geo.frameTop,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1.2,
      'stroke-dasharray': '6 4',
    }),
  );

  // Internal pilot supply: off port 1's line at a junction, along the bottom, up the left, into
  // the stage's inlet.
  g.append(
    seg(port1X, geo.supplyY, geo.supplyX, geo.supplyY, dashed),
    seg(geo.supplyX, geo.supplyY, geo.supplyX, cy, dashed),
    seg(geo.supplyX, cy, left, cy, dashed),
    createSvgEl('circle', { cx: port1X, cy: geo.supplyY, r: 2.5, fill: '#111' }),
  );

  // The stage: a box with its flow path drawn through it, inlet left, outlet right.
  g.appendChild(
    createSvgEl('rect', {
      x: left,
      y: geo.stageTop,
      width: right - left,
      height: geo.stageBottom - geo.stageTop,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  g.append(
    seg(left + 6, cy, right - 9, cy, { 'stroke-width': 1.5 }),
    createSvgEl('path', {
      d: `M ${right - 4} ${cy} L ${right - 11} ${cy - 4} L ${right - 11} ${cy + 4} Z`,
      fill: '#111',
    }),
  );

  // Setting spring on top - a vertical zigzag - with the diagonal arrow that makes it adjustable.
  const zig = geo.springLen / 6;
  const pts: string[] = [`${geo.stageX} ${geo.stageTop}`];
  for (let k = 1; k <= 5; k++) {
    pts.push(`${geo.stageX + (k % 2 ? 6 : -6)} ${geo.stageTop - k * zig}`);
  }
  pts.push(`${geo.stageX} ${geo.stageTop - geo.springLen}`);
  const top = geo.stageTop - geo.springLen;
  g.append(
    createSvgEl('polyline', {
      points: pts.join(' '),
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1.5,
    }),
    seg(geo.stageX - 10, geo.stageTop - 2, geo.stageX + 8, top + 3, { 'stroke-width': 1.2 }),
    createSvgEl('path', {
      d: `M ${geo.stageX + 11} ${top - 1} L ${geo.stageX + 4} ${top + 3} L ${geo.stageX + 10} ${top + 7} Z`,
      fill: '#111',
    }),
  );

  // Control signal from port 12 acting on the stage from below (open arrowhead: it's a
  // pressure signal, not a flow path).
  const arrowTip = geo.stageBottom + 4;
  g.append(
    seg(geo.stageX, geo.portY, geo.stageX, arrowTip),
    createSvgEl('path', {
      d: `M ${geo.stageX - 5} ${arrowTip + 9} L ${geo.stageX} ${arrowTip} L ${geo.stageX + 5} ${arrowTip + 9}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 1.5,
    }),
  );

  // Stage outlet to the 3/2 valve's air pilot (open triangle on the valve wall).
  g.append(
    seg(right, cy, geo.pilotBaseX, cy),
    createSvgEl('path', {
      d: `M ${geo.pilotBaseX} ${cy - geo.pilotHalfHeight} L -1 ${cy} L ${geo.pilotBaseX} ${cy + geo.pilotHalfHeight} Z`,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 1.5,
    }),
  );
}

/**
 * Pressure sequence valve: a spring-return 3/2 valve, normally closed, that switches (1 -> 2)
 * once the pressure at control port 12 reaches its set pressure, and drops back as soon as it
 * falls below it. The air that actually moves the valve comes from port 1 inside the unit, so
 * with no supply at 1 it can't switch whatever 12 is doing. Used to start the next step of a
 * sequence only once pressure has built up somewhere - typically a cylinder chamber that has
 * reached its end position, or a clamp that has reached its clamping force.
 */
export function createPressureSequenceValve(
  compLayer: HTMLElement,
  x: number,
  y: number,
): Component {
  const geo = PRESSURE_SEQUENCE_VALVE_DEFAULT_GEOMETRY;
  const ox = GEOMETRY.offsetX;
  const oy = GEOMETRY.offsetY;
  const shell = buildComponentShell(
    compLayer,
    PRESSURE_SEQUENCE_VALVE_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    'Pressure sequence valve',
    {
      x: ox + geo.frameLeft,
      y: oy + geo.frameTop,
      w: geo.frameRight - geo.frameLeft,
      h: geo.frameBottom - geo.frameTop,
    },
  );

  const valve = buildSlidingValve32Body(shell.svg, `arrow-seq-${uid()}`, GEOMETRY);
  const port1X = Number(valve.ports['1'].el.getAttribute('cx')) - ox;

  const stage = createSvgEl('g', { transform: `translate(${ox}, ${oy})` });
  drawPilotStage(stage, geo, port1X);
  // Behind the valve body (its frame and supply line run under the body's own port leads).
  shell.svg.insertBefore(stage, shell.svg.firstChild);

  const spring = createSvgEl('g', {
    transform: `translate(${ox + SLIDING_VALVE_W}, ${oy + SLIDING_VALVE_H / 2})`,
  });
  addSpringZigzag(spring, 0, SPRING_DEFAULT_GEOMETRY.springSpan, 0, 2, SPRING_DEFAULT_GEOMETRY);
  shell.svg.appendChild(spring);

  const port12: PortDef = createLabeledPort(
    shell.svg,
    '12',
    ox + geo.stageX,
    oy + geo.portY,
    'V',
    'left',
  );

  // The set pressure, written beside the setting spring it belongs to.
  const setLabel = createSvgEl('text', {
    x: ox + geo.stageX + 14,
    y: oy + geo.stageTop - geo.springLen + 8,
    'font-size': 11,
  });
  shell.svg.appendChild(setLabel);

  const ports = { ...valve.ports, '12': port12 };

  let setPressure = DEFAULT_SET_PRESSURE;
  let active = false;

  function updateLabel(): void {
    setLabel.textContent = `${setPressure.toFixed(1)} bar`;
  }
  updateLabel();

  function show(): void {
    // Switched: the flow cell trades places with the exhaust cell under the ports.
    valve.setSwapped(active);
  }

  const comp: Component = {
    id: uid(),
    type: PRESSURE_SEQUENCE_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return active ? [{ a: '2', b: '1' }] : [{ a: '2', b: '3' }];
    },

    step(_dt: number, ctx: SimStepContext): void {
      // A hair of tolerance so a set pressure equal to what arrives (e.g. 6 bar from an
      // unregulated supply) reliably counts as reached.
      active = ctx.isPressurized('1') && ctx.pressureAt('12') >= setPressure - 1e-9;
      show();
    },

    snapshot(): Record<string, unknown> {
      return {
        setPressure,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3: valve.getSilencer(),
      };
    },
    restore(data: Record<string, unknown>): void {
      const next = Number(data.setPressure);
      setPressure = Number.isFinite(next)
        ? Math.max(0, Math.min(SOURCE_PRESSURE, next))
        : DEFAULT_SET_PRESSURE;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      valve.setSilencer((data.silencer3 as 'none' | 'silencer') ?? 'silencer');
      updateLabel();
    },
    reset(): void {
      active = false;
      show();
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  valve.setActive(false);
  show();

  return comp;
}
