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
// Local to the mover (not the outer canvas) - reparented into it, so it must use the mover's
// own coordinate system, matching SLIDING_VALVE_H rather than the padded outer SVG_H.
const PILOT_LOCAL = { cx: -40, cy: SLIDING_VALVE_H / 2 };
const DEFAULT_DELAY_SEC = 1.0;

/**
 * Pneumatic ON-delay timer: built on the same sliding two-cell 3/2 body as the other pilot
 * valves, but the pilot side shows a small clock symbol (instead of a triangle/roller) to mark
 * it as time-driven. Port 12 must stay pressurized continuously for `delaySec` before the
 * valve switches; it resets immediately (spring return) the instant the pilot depressurizes.
 */
export function createTimeDelayValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, TIME_DELAY_VALVE_TYPE, x, y, SVG_W, SVG_H, '', {
    x: SLIDING_VALVE_OFFSET_X,
    y: SLIDING_VALVE_OFFSET_Y,
    w: SLIDING_VALVE_W,
    h: SLIDING_VALVE_H,
  });
  const valve = buildSlidingValve32Body(shell.svg, `arrow-delay-${uid()}`);

  const spring = createSvgEl('g', {
    transform: `translate(${SLIDING_VALVE_W}, ${SLIDING_VALVE_H / 2})`,
  });
  spring.appendChild(
    createSvgEl('path', { d: 'M 0 0 L 20 0', fill: 'none', stroke: '#111', 'stroke-width': 2 }),
  );
  spring.appendChild(
    createSvgEl('path', {
      d: 'M 20 0 l 10 -10 l 10 20 l 10 -20',
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  // Clock symbol marks the pilot side as time-delayed rather than mechanically/manually driven.
  // Coordinates below are local to the mover, not the outer canvas.
  const clock = createSvgEl('g', { transform: `translate(-26, ${SLIDING_VALVE_H / 2})` });
  clock.appendChild(
    createSvgEl('circle', { cx: 0, cy: 0, r: 12, fill: '#fff', stroke: '#111', 'stroke-width': 2 }),
  );
  clock.appendChild(
    createSvgEl('line', { x1: 0, y1: 0, x2: 0, y2: -7, stroke: '#111', 'stroke-width': 1.5 }),
  );
  clock.appendChild(
    createSvgEl('line', { x1: 0, y1: 0, x2: 5, y2: 2, stroke: '#111', 'stroke-width': 1.5 }),
  );
  const pilotLink = createSvgEl('path', {
    d: `M -14 ${SLIDING_VALVE_H / 2} L ${PILOT_LOCAL.cx} ${PILOT_LOCAL.cy}`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const pilotLink2 = createSvgEl('path', {
    d: `M 0 ${SLIDING_VALVE_H / 2} L -14 ${SLIDING_VALVE_H / 2}`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const port12 = createPort(shell.svg, '12', PILOT_LOCAL.cx, PILOT_LOCAL.cy, 'H', {
    isPilot: true,
    pilotDir: -1,
  });
  valve.mover.append(pilotLink, pilotLink2, clock, port12.el, spring);

  // Not part of the mover (doesn't slide) - positioned in canvas-absolute coordinates instead.
  const delayLabel = createSvgEl('text', {
    x: SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W / 2,
    y: SLIDING_VALVE_OFFSET_Y - 18,
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
      return { delaySec };
    },
    restore(data: Record<string, unknown>): void {
      delaySec = data.delaySec as number;
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
