import type { Component, PortConnection, SimStepContext } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';
import {
  buildSlidingValve32Body,
  SLIDING_VALVE_W,
  SLIDING_VALVE_H,
  SLIDING_VALVE_OFFSET_X,
  SLIDING_VALVE_OFFSET_Y,
} from './shared/slidingValve32';

export const TIME_DELAY_VALVE_TYPE = 'timeDelayValve';

// Extra right-side room for the spring symbol, beyond the offset already reserved on the left.
const SVG_W = SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W + 48;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 30;
const DEFAULT_DELAY_SEC = 1.0;

export interface TimeDelayValveGeometry {
  /** x of the pilot port 12, relative to the mover's own origin. */
  pilotPortX: number;
  /** x of the link segment where it bends on its way in from the pilot port to the clock. */
  pilotLinkInnerX: number;
  clockX: number;
  clockR: number;
  clockHourLen: number;
  clockMinuteDx: number;
  clockMinuteDy: number;
  /** y offset (above the frame) of the delay-seconds label - in canvas coordinates, not the mover's. */
  delayLabelYOffset: number;
  springSegLen: number;
  springZigW: number;
  springZigH: number;
}

export const TIME_DELAY_VALVE_DEFAULT_GEOMETRY: TimeDelayValveGeometry = {
  pilotPortX: -40,
  pilotLinkInnerX: -14,
  clockX: -26,
  clockR: 12,
  clockHourLen: 7,
  clockMinuteDx: 5,
  clockMinuteDy: 2,
  delayLabelYOffset: -18,
  springSegLen: 20,
  springZigW: 10,
  springZigH: 10,
};

/**
 * Draws the clock symbol + pilot link + spring into the mover, matching the original app's
 * time-delay artwork (a clock stands in for the triangle/roller used by the other pilot
 * actuators, marking this valve as time-driven rather than mechanically/manually driven).
 * Coordinates are local to the mover, not the canvas.
 */
export function drawTimeDelayValveActuator(
  mover: SVGGElement,
  svg: SVGSVGElement,
  geo: TimeDelayValveGeometry,
): { port12: ReturnType<typeof createPort> } {
  const cy = SLIDING_VALVE_H / 2;

  const spring = createSvgEl('g', { transform: `translate(${SLIDING_VALVE_W}, ${cy})` });
  spring.appendChild(
    createSvgEl('path', {
      d: `M 0 0 L ${geo.springSegLen} 0`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  const s = geo.springSegLen;
  const zw = geo.springZigW;
  const zh = geo.springZigH;
  spring.appendChild(
    createSvgEl('path', {
      d: `M ${s} 0 l ${zw} ${-zh} l ${zw} ${zh * 2} l ${zw} ${-zh * 2}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  const clock = createSvgEl('g', { transform: `translate(${geo.clockX}, ${cy})` });
  clock.appendChild(
    createSvgEl('circle', {
      cx: 0,
      cy: 0,
      r: geo.clockR,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  clock.appendChild(
    createSvgEl('line', {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: -geo.clockHourLen,
      stroke: '#111',
      'stroke-width': 1.5,
    }),
  );
  clock.appendChild(
    createSvgEl('line', {
      x1: 0,
      y1: 0,
      x2: geo.clockMinuteDx,
      y2: geo.clockMinuteDy,
      stroke: '#111',
      'stroke-width': 1.5,
    }),
  );
  const pilotLink = createSvgEl('path', {
    d: `M ${geo.pilotLinkInnerX} ${cy} L ${geo.pilotPortX} ${cy}`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const pilotLink2 = createSvgEl('path', {
    d: `M 0 ${cy} L ${geo.pilotLinkInnerX} ${cy}`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const port12 = createPort(svg, '12', geo.pilotPortX, cy, 'H', {
    isPilot: true,
    pilotDir: -1,
  });
  mover.append(pilotLink, pilotLink2, clock, port12.el, spring);
  return { port12 };
}

/**
 * Pneumatic ON-delay timer: built on the same sliding two-cell 3/2 body as the other pilot
 * valves, but the pilot side shows a small clock symbol (instead of a triangle/roller) to mark
 * it as time-driven. Port 12 must stay pressurized continuously for `delaySec` before the
 * valve switches; it resets immediately (spring return) the instant the pilot depressurizes.
 */
export function createTimeDelayValve(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = TIME_DELAY_VALVE_DEFAULT_GEOMETRY;
  const shell = buildComponentShell(
    compLayer,
    TIME_DELAY_VALVE_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    'Time delay valve',
    {
      x: SLIDING_VALVE_OFFSET_X,
      y: SLIDING_VALVE_OFFSET_Y,
      w: SLIDING_VALVE_W,
      h: SLIDING_VALVE_H,
    },
  );
  const valve = buildSlidingValve32Body(shell.svg, `arrow-delay-${uid()}`);
  const { port12 } = drawTimeDelayValveActuator(valve.mover, shell.svg, geo);

  // Not part of the mover (doesn't slide) - positioned in canvas-absolute coordinates instead.
  const delayLabel = createSvgEl('text', {
    x: SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W / 2,
    y: SLIDING_VALVE_OFFSET_Y + geo.delayLabelYOffset,
    'text-anchor': 'middle',
    'font-size': 11,
  });
  delayLabel.style.cursor = 'pointer';
  shell.svg.appendChild(delayLabel);

  const ports = { ...valve.ports, '12': port12 };

  let active = false;
  let timer = 0;
  let delaySec = DEFAULT_DELAY_SEC;

  function updateLabel(): void {
    delayLabel.textContent = `${delaySec.toFixed(1)}s`;
  }
  updateLabel();

  const comp: Component = {
    id: uid(),
    type: TIME_DELAY_VALVE_TYPE,
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
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3: valve.getSilencer(),
      };
    },
    restore(data: Record<string, unknown>): void {
      delaySec = data.delaySec as number;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      valve.setSilencer((data.silencer3 as 'none' | 'silencer') ?? 'silencer');
      updateLabel();
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

  valve.setActive(false);

  return comp;
}
