import type { Component, PortConnection, SimStepContext } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';
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

export const COUNTER_TYPE = 'counter';

const DEFAULT_PRESET = 3;
export const MAX_PRESET = 999;

/** Room for the counter element left of the valve - as the time delay valve's pilot circuit, so
 * the two line up and their ports sit on the same grid. */
const PILOT_ROOM = 60;
const GEOMETRY: SlidingValve32Geometry = {
  ...SLIDING_VALVE_32_DEFAULT_GEOMETRY,
  offsetX: SLIDING_VALVE_OFFSET_X + PILOT_ROOM,
};
const SVG_W = GEOMETRY.offsetX + SLIDING_VALVE_W + 50 + PILOT_ROOM;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 34;

/** The counter element, in the mover's coordinates (its origin is the valve's left wall). */
const BOX_X = -58;
const BOX_W = 54;
const BOX_Y = 8;
const BOX_H = SLIDING_VALVE_H - 16;
/** Count input Z (port 12), on the left; -102 puts it on the 10px grid (see grid.ts). */
const PORT_Z_X = -102;
/** Reset input Y (port 10), below the box; both on the 10px grid. */
const PORT_Y_X = -32;
const PORT_Y_Y = 80;

function seg(x1: number, y1: number, x2: number, y2: number, width = 2): SVGElement {
  return createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': width });
}

function pilotTriangle(tipX: number, tipY: number, dx: number, dy: number): SVGElement {
  // A filled air-pilot triangle, its tip at (tipX, tipY), pointing along (dx, dy).
  const bx = tipX - dx * 12;
  const by = tipY - dy * 12;
  const px = -dy * 6;
  const py = dx * 6;
  return createSvgEl('path', {
    d: `M ${tipX} ${tipY} L ${bx + px} ${by + py} L ${bx - px} ${by - py} Z`,
    fill: '#111',
  });
}

/**
 * Pneumatic preset counter (ISO 1219): a spring-return 3/2 valve driven by a counter element.
 * Each pressure pulse on Z (port 12) counts one; when the count reaches the preset the valve
 * switches, 1 to 2, and stays switched until a signal on Y (port 10) resets the count. While Y
 * is pressurized nothing is counted. The element shows the count and the preset.
 */
export function createCounter(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, COUNTER_TYPE, x, y, SVG_W, SVG_H, 'Counter', {
    x: GEOMETRY.offsetX + BOX_X - 4,
    y: GEOMETRY.offsetY,
    w: -BOX_X + 4 + SLIDING_VALVE_W + SPRING_DEFAULT_GEOMETRY.springSpan,
    h: SLIDING_VALVE_H,
  });
  const valve = buildSlidingValve32Body(shell.svg, `arrow-counter-${uid()}`, GEOMETRY);
  shell.followFrame(valve.mover, valve.rest.x, valve.rest.y);

  const cy = SLIDING_VALVE_H / 2;
  const element = createSvgEl('g');
  element.append(
    // The counter element, joined to the valve's end.
    createSvgEl('rect', {
      x: BOX_X,
      y: BOX_Y,
      width: BOX_W,
      height: BOX_H,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
    seg(BOX_X + BOX_W, cy, 0, cy),
    // Z: count input, into the element's left side.
    seg(PORT_Z_X, cy, BOX_X - 12, cy),
    pilotTriangle(BOX_X, cy, 1, 0),
    // Y: reset input, into its underside.
    seg(PORT_Y_X, PORT_Y_Y, PORT_Y_X, BOX_Y + BOX_H + 12),
    pilotTriangle(PORT_Y_X, BOX_Y + BOX_H, 0, -1),
  );
  const zLabel = createSvgEl('text', { x: PORT_Z_X + 8, y: cy - 10, 'font-size': 11 });
  zLabel.textContent = '12 (Z)';
  const yLabel = createSvgEl('text', {
    x: PORT_Y_X - 8,
    y: PORT_Y_Y - 4,
    'text-anchor': 'end',
    'font-size': 11,
  });
  yLabel.textContent = '10 (Y)';
  // The count over the preset, inside the element.
  const countText = createSvgEl('text', {
    x: BOX_X + BOX_W / 2,
    y: cy - 2,
    'text-anchor': 'middle',
    'font-size': 13,
    'font-weight': 600,
  });
  const presetText = createSvgEl('text', {
    x: BOX_X + BOX_W / 2,
    y: cy + 13,
    'text-anchor': 'middle',
    'font-size': 10,
    fill: '#555',
  });
  element.append(zLabel, yLabel, countText, presetText);

  const spring = createSvgEl('g', { transform: `translate(${SLIDING_VALVE_W}, ${cy})` });
  addSpringZigzag(spring, 0, SPRING_DEFAULT_GEOMETRY.springSpan, 0, 2, SPRING_DEFAULT_GEOMETRY);

  const portZ = createPort(shell.svg, '12', PORT_Z_X, cy, 'H', { isPilot: true, pilotDir: -1 });
  const portY = createPort(shell.svg, '10', PORT_Y_X, PORT_Y_Y, 'V', {
    isPilot: true,
    pilotDir: 1,
  });
  valve.mover.append(element, portZ.el, portY.el, spring);

  const ports = { ...valve.ports, '12': portZ, '10': portY };

  let preset = DEFAULT_PRESET;
  let count = 0;
  let countWas = false;

  function done(): boolean {
    return count >= preset;
  }
  function draw(): void {
    countText.textContent = String(count);
    presetText.textContent = `of ${preset}`;
    valve.setActive(done());
  }

  const comp: Component = {
    id: uid(),
    type: COUNTER_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return done() ? [{ a: '2', b: '1' }] : [{ a: '2', b: '3' }];
    },

    step(_dt: number, ctx: SimStepContext): void {
      // A pilot port reads pressurized once it holds enough to pilot (see sim/engine.ts).
      const z = ctx.isPressurized('12');
      if (ctx.isPressurized('10')) count = 0;
      else if (z && !countWas && !done()) count += 1;
      countWas = z;
      draw();
    },

    snapshot(): Record<string, unknown> {
      return {
        preset,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3: valve.getSilencer(),
      };
    },
    restore(data: Record<string, unknown>): void {
      const p = Math.round(Number(data.preset));
      preset = Number.isFinite(p) ? Math.min(MAX_PRESET, Math.max(1, p)) : DEFAULT_PRESET;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      valve.setSilencer((data.silencer3 as 'none' | 'silencer') ?? 'silencer');
      draw();
    },
    reset(): void {
      count = 0;
      countWas = false;
      draw();
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  draw();
  return comp;
}
