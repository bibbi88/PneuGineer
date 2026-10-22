import type { Component, PortConnection, SimStepContext } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';
import {
  buildSlidingValve32Body,
  SLIDING_VALVE_32_DEFAULT_GEOMETRY,
  type SlidingValve32Geometry,
  SLIDING_VALVE_W,
  SLIDING_VALVE_H,
  SLIDING_VALVE_OFFSET_X,
  SLIDING_VALVE_OFFSET_Y,
} from './shared/slidingValve32';
import { addSpringZigzag, SPRING_DEFAULT_GEOMETRY } from './shared/spring';
import { drawBallCheckSymbol } from './shared/checkValveSymbol';

export const TIME_DELAY_VALVE_TYPE = 'timeDelayValve';
/** The same valve with its 3/2 valve normally open: output on at once, off after the delay - a
 * "pulse valve" (one-shot), used to shorten a signal that would otherwise hold a pilot on. */
export const TIME_DELAY_VALVE_NO_TYPE = 'timeDelayValveNO';

/** Room added on each side of the canvas for the pilot circuit drawn left of the valve. Equal on
 * both sides, so the canvas center - which is what the component's position is - stays put and
 * diagrams saved with the older, clock-symbol artwork keep the valve exactly where it was. */
const PILOT_ROOM = 60;
const GEOMETRY: SlidingValve32Geometry = {
  ...SLIDING_VALVE_32_DEFAULT_GEOMETRY,
  offsetX: SLIDING_VALVE_OFFSET_X + PILOT_ROOM,
};

// Extra right-side room for the spring symbol, beyond the offset already reserved on the left.
// (+50/+34 rather than the "natural" +48/+30: chosen so ports 1/2/3 land exactly on the 10px
// grid relative to this canvas's own center - see src/core/grid.ts.)
const SVG_W = GEOMETRY.offsetX + SLIDING_VALVE_W + 50 + PILOT_ROOM;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 34;
const DEFAULT_DELAY_SEC = 1.0;

export interface TimeDelayValveGeometry {
  /** x of the pilot port 12, relative to the mover's own origin (the valve's left wall). */
  pilotPortX: number;
  /** x of the pilot triangle's base and tip (the tip touches the valve's left wall). */
  pilotBaseX: number;
  pilotTipX: number;
  pilotHalfHeight: number;
  /** x where the reservoir hangs off the pilot line, and the reservoir's size/position below it. */
  reservoirX: number;
  reservoirW: number;
  reservoirH: number;
  reservoirTop: number;
  /** Center x of the one-way flow control (throttle + bypass check valve), its half-length, and
   * how far above the pilot line the check valve's bypass runs. */
  flowControlX: number;
  flowControlHalf: number;
  bypassRise: number;
  /** Dash-dot frame round the whole assembly, relative to the valve body. */
  framePadLeft: number;
  framePadRight: number;
  framePadY: number;
  /** y offset (above the frame) of the delay-seconds label - in canvas coordinates, not the mover's. */
  delayLabelYOffset: number;
  /** Return spring - see SPRING_DEFAULT_GEOMETRY in shared/spring.ts, which every
   * valve's spring is drawn from so the symbol set shares one design. */
  springSpan: number;
  springSegLen: number;
  springZigW: number;
  springZigH: number;
}

export const TIME_DELAY_VALVE_DEFAULT_GEOMETRY: TimeDelayValveGeometry = {
  // -102: puts port 12 on the 10px grid (170 left of the canvas center) - see src/core/grid.ts.
  pilotPortX: -102,
  pilotBaseX: -14,
  pilotTipX: -2,
  pilotHalfHeight: 6,
  reservoirX: -26,
  reservoirW: 30,
  reservoirH: 14,
  reservoirTop: 42,
  flowControlX: -64,
  flowControlHalf: 20,
  bypassRise: 18,
  framePadLeft: 92,
  framePadRight: 40,
  framePadY: 4,
  delayLabelYOffset: -18,
  springSpan: SPRING_DEFAULT_GEOMETRY.springSpan,
  springSegLen: SPRING_DEFAULT_GEOMETRY.springSegLen,
  springZigW: SPRING_DEFAULT_GEOMETRY.springZigW,
  springZigH: SPRING_DEFAULT_GEOMETRY.springZigH,
};

function stroke(el: SVGElement, width = 2): SVGElement {
  el.setAttribute('stroke', '#111');
  el.setAttribute('stroke-width', String(width));
  el.setAttribute('fill', 'none');
  return el;
}

function seg(x1: number, y1: number, x2: number, y2: number, width = 2): SVGElement {
  return stroke(createSvgEl('line', { x1, y1, x2, y2 }), width);
}

/**
 * Draws the ISO 1219 time delay valve's pilot circuit, spring and frame into the mover: port 12
 * feeds the valve's air pilot through a one-way flow control valve - an adjustable throttle,
 * with a check valve in a bypass that lets the pilot vent freely the other way - and a small
 * reservoir hanging off the pilot line. Filling the reservoir through the throttle is what takes
 * the time; the check valve is why it resets at once. Everything sits inside the dash-dot frame
 * that marks the parts as one assembled unit. Coordinates are local to the mover.
 */
export function drawTimeDelayValveActuator(
  mover: SVGGElement,
  svg: SVGSVGElement,
  geo: TimeDelayValveGeometry,
): { port12: ReturnType<typeof createPort> } {
  const cy = SLIDING_VALVE_H / 2;
  const parts = createSvgEl('g');

  // Frame first, so everything else draws over it.
  parts.appendChild(
    stroke(
      createSvgEl('rect', {
        x: -geo.framePadLeft,
        y: -geo.framePadY,
        width: geo.framePadLeft + SLIDING_VALVE_W + geo.framePadRight,
        height: SLIDING_VALVE_H + 2 * geo.framePadY,
        'stroke-dasharray': '10 3 2 3',
      }),
      1.2,
    ),
  );

  // Pilot line, port 12 -> flow control -> reservoir tee -> pilot triangle on the valve wall.
  const fcLeft = geo.flowControlX - geo.flowControlHalf;
  const fcRight = geo.flowControlX + geo.flowControlHalf;
  parts.append(seg(geo.pilotPortX, cy, geo.pilotBaseX, cy));
  parts.appendChild(
    createSvgEl('path', {
      d: `M ${geo.pilotBaseX} ${cy - geo.pilotHalfHeight} L ${geo.pilotTipX} ${cy} L ${geo.pilotBaseX} ${cy + geo.pilotHalfHeight} Z`,
      fill: '#111',
    }),
  );

  // Throttle: two arcs pinching the line, with the diagonal arrow that makes it adjustable.
  const tx = geo.flowControlX;
  parts.append(
    stroke(
      createSvgEl('path', { d: `M ${tx - 8} ${cy - 7} Q ${tx} ${cy + 1} ${tx + 8} ${cy - 7}` }),
    ),
    stroke(
      createSvgEl('path', { d: `M ${tx - 8} ${cy + 7} Q ${tx} ${cy - 1} ${tx + 8} ${cy + 7}` }),
    ),
    seg(tx - 11, cy + 11, tx + 8, cy - 8, 1.5),
    createSvgEl('path', {
      d: `M ${tx + 12} ${cy - 12} L ${tx + 3} ${cy - 9} L ${tx + 9} ${cy - 3} Z`,
      fill: '#111',
    }),
  );

  // Check valve in the bypass above: free flow back toward port 12 only (reservoir venting).
  const by = cy - geo.bypassRise;
  const check = drawBallCheckSymbol(parts, tx, by, 'horizontal', -1, 0.45);
  parts.append(
    seg(fcLeft, cy, fcLeft, by),
    seg(fcLeft, by, check.outPoint.x, by),
    seg(check.inPoint.x, by, fcRight, by),
    seg(fcRight, by, fcRight, cy),
  );

  // Reservoir, hanging off the pilot line.
  parts.append(
    seg(geo.reservoirX, cy, geo.reservoirX, geo.reservoirTop),
    createSvgEl('rect', {
      x: geo.reservoirX - geo.reservoirW / 2,
      y: geo.reservoirTop,
      width: geo.reservoirW,
      height: geo.reservoirH,
      rx: geo.reservoirH / 2,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  const label12 = createSvgEl('text', {
    x: geo.pilotPortX - 4,
    y: cy - 12,
    'text-anchor': 'middle',
    'font-size': 11,
  });
  label12.textContent = '12';
  parts.appendChild(label12);

  const spring = createSvgEl('g', { transform: `translate(${SLIDING_VALVE_W}, ${cy})` });
  addSpringZigzag(spring, 0, geo.springSpan, 0, 2, geo);

  const port12 = createPort(svg, '12', geo.pilotPortX, cy, 'H', {
    isPilot: true,
    pilotDir: -1,
  });
  // The frame goes behind the valve body (already in the mover); the rest on top.
  const frame = parts.firstElementChild as SVGElement;
  mover.insertBefore(frame, mover.firstChild);
  mover.append(parts, port12.el, spring);
  return { port12 };
}

/**
 * Pneumatic time delay valve: a spring-return 3/2 valve whose air pilot is fed from port 12
 * through a throttle and a small reservoir (see drawTimeDelayValveActuator). Port 12 must stay
 * pressurized continuously for `delaySec` before the valve switches; it resets immediately
 * (spring return) the instant the pilot depressurizes.
 *
 * Normally closed (the default) it's an on-delay: 2 comes on `delaySec` after 12 does. Normally
 * open it's the reverse: 2 is on at once and goes off after `delaySec` - with 1 and 12 fed from
 * the same signal, that turns a held signal into a pulse of that length.
 */
export function createTimeDelayValve(
  compLayer: HTMLElement,
  x: number,
  y: number,
  variant: 'NC' | 'NO' = 'NC',
): Component {
  const geo = TIME_DELAY_VALVE_DEFAULT_GEOMETRY;
  const fixedNormallyOpen = variant === 'NO';
  const shell = buildComponentShell(
    compLayer,
    fixedNormallyOpen ? TIME_DELAY_VALVE_NO_TYPE : TIME_DELAY_VALVE_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    fixedNormallyOpen ? 'Time delay valve, normally open' : 'Time delay valve',
    {
      x: GEOMETRY.offsetX - geo.framePadLeft,
      y: GEOMETRY.offsetY - geo.framePadY,
      w: geo.framePadLeft + SLIDING_VALVE_W + geo.framePadRight,
      h: SLIDING_VALVE_H + 2 * geo.framePadY,
    },
  );
  const valve = buildSlidingValve32Body(shell.svg, `arrow-delay-${uid()}`, GEOMETRY);
  const { port12 } = drawTimeDelayValveActuator(valve.mover, shell.svg, geo);

  // Not part of the mover (doesn't slide) - positioned in canvas-absolute coordinates instead.
  const delayLabel = createSvgEl('text', {
    x: GEOMETRY.offsetX + SLIDING_VALVE_W / 2,
    y: GEOMETRY.offsetY + geo.delayLabelYOffset,
    'text-anchor': 'middle',
    'font-size': 11,
  });
  delayLabel.style.cursor = 'pointer';
  shell.svg.appendChild(delayLabel);

  const ports = { ...valve.ports, '12': port12 };

  let active = false;
  // Swaps the two cells so the valve passes 1 -> 2 at rest instead of blocking it, turning it
  // normally open - see pushButton32.ts, which this mirrors. Only the artwork and the rule
  // change: actuating still slides the mover the same way, so the actuator animates identically
  // either way round.
  let normallyOpen = fixedNormallyOpen;

  /** True while 1 is connected through to 2, whichever combination of actuated and
   * normally-open produced it - both the symbol and the rule follow this one value. */
  function flowing(): boolean {
    return active !== normallyOpen;
  }
  let timer = 0;
  let delaySec = DEFAULT_DELAY_SEC;

  function updateLabel(): void {
    delayLabel.textContent = `${delaySec.toFixed(1)}s`;
  }
  updateLabel();

  const comp: Component = {
    id: uid(),
    type: fixedNormallyOpen ? TIME_DELAY_VALVE_NO_TYPE : TIME_DELAY_VALVE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return flowing() ? [{ a: '2', b: '1' }] : [{ a: '2', b: '3' }];
    },

    step(dt: number, ctx: SimStepContext): void {
      if (ctx.isPressurized('12')) {
        timer += dt;
        if (timer >= delaySec) active = true;
      } else {
        timer = 0;
        active = false;
      }
      valve.setActive(active);
    },

    snapshot(): Record<string, unknown> {
      return {
        delaySec,
        normallyOpen,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3: valve.getSilencer(),
      };
    },
    restore(data: Record<string, unknown>): void {
      delaySec = data.delaySec as number;
      // The normally-open variant is that by definition; the plain valve keeps its own option.
      normallyOpen = fixedNormallyOpen || Boolean(data.normallyOpen);
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      valve.setSilencer((data.silencer3 as 'none' | 'silencer') ?? 'silencer');
      updateLabel();
      valve.setSwapped(normallyOpen);
      valve.setActive(active);
    },
    reset(): void {
      active = false;
      timer = 0;
      valve.setActive(false);
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  function promptDelay(): void {
    const answer = window.prompt('Delay in seconds:', String(delaySec));
    if (answer === null) return;
    const value = Number(answer);
    if (!Number.isFinite(value) || value < 0) return;
    delaySec = value;
    updateLabel();
  }
  delayLabel.addEventListener('click', (e) => {
    e.stopPropagation();
    promptDelay();
  });

  valve.setSwapped(normallyOpen);
  valve.setActive(false);

  return comp;
}
