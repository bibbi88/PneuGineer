import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl } from './shared/svgHelpers';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import {
  buildSlidingValve32Body,
  SLIDING_VALVE_W,
  SLIDING_VALVE_H,
  SLIDING_VALVE_OFFSET_X,
  SLIDING_VALVE_OFFSET_Y,
} from './shared/slidingValve32';

export const PUSH_BUTTON_32_TYPE = 'pushButton32';

// Extra right-side room for the spring symbol, beyond the offset already reserved on the left.
const SVG_W = SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W + 48;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 30;
const MID_X = SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W / 2;

export function createPushButton32(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(
    compLayer,
    PUSH_BUTTON_32_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    '3/2 push button',
    {
      x: SLIDING_VALVE_OFFSET_X,
      y: SLIDING_VALVE_OFFSET_Y,
      w: SLIDING_VALVE_W,
      h: SLIDING_VALVE_H,
    },
  );
  const valve = buildSlidingValve32Body(shell.svg, `arrow-push-${uid()}`);

  // Actuator rod (replaces a roller) + fork into the body - moves with the mover, matching
  // the original app's pushButton32 artwork. Coordinates are local to the mover, not the canvas.
  const actuator = createSvgEl('line', {
    x1: -20,
    y1: 10,
    x2: -20,
    y2: SLIDING_VALVE_H - 10,
    stroke: '#111',
    'stroke-width': 2,
  });
  const forkTop = createSvgEl('path', {
    d: 'M -20 20 L 0 20',
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const forkBot = createSvgEl('path', {
    d: `M -20 ${SLIDING_VALVE_H - 20} L 0 ${SLIDING_VALVE_H - 20}`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
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
  valve.mover.append(forkTop, forkBot, actuator, spring);

  let active = false;
  // True while the button is held active by a CTRL-click latch rather than the mouse being
  // physically down - lets one button stay pressed while the user operates another with plain
  // clicks, matching a real "detent" pushbutton.
  let latched = false;

  const comp: Component = {
    id: uid(),
    type: PUSH_BUTTON_32_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports: valve.ports,

    conductivityRule(): PortConnection[] {
      return active ? [{ a: '2', b: '1' }] : [{ a: '2', b: '3' }];
    },

    recompute(): void {
      valve.setActive(active);
    },

    snapshot(): Record<string, unknown> {
      return {
        active,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3: valve.getSilencer(),
      };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      valve.setSilencer((data.silencer3 as 'none' | 'silencer') ?? 'silencer');
      valve.setActive(active);
    },
    reset(): void {
      active = false;
      latched = false;
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

  function setActive(a: boolean): void {
    if (active === a) return;
    active = a;
    valve.setActive(a);
  }

  function isInLeftHalf(clientX: number): boolean {
    const rect = shell.svg.getBoundingClientRect();
    return clientX - rect.left < (MID_X / SVG_W) * rect.width;
  }

  shell.svg.addEventListener('mousedown', (e) => {
    if (appState.mode === Modes.STOP) return;
    if (!isInLeftHalf(e.clientX)) return;
    if (latched) {
      // A second mouse-press on an already-latched button releases it.
      latched = false;
      setActive(false);
      return;
    }
    if (e.ctrlKey) {
      latched = true;
      setActive(true);
      return;
    }
    setActive(true);
  });
  window.addEventListener('mouseup', () => {
    if (!latched) setActive(false);
  });
  shell.svg.addEventListener('mouseleave', () => {
    if (!latched) setActive(false);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control' && latched) {
      latched = false;
      setActive(false);
    }
  });

  valve.setActive(false);

  return comp;
}
