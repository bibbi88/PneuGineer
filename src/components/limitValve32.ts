import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl } from './shared/svgHelpers';
import {
  buildSlidingValve32Body,
  SLIDING_VALVE_W,
  SLIDING_VALVE_H,
  SLIDING_VALVE_OFFSET_X,
  SLIDING_VALVE_OFFSET_Y,
} from './shared/slidingValve32';
import { getSignal } from '../sim/signals';

export const LIMIT_VALVE_32_TYPE = 'limitValve32';

// Extra right-side room for the spring symbol, beyond the offset already reserved on the left.
const SVG_W = SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W + 48;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 30;
// Cylinder end-of-stroke signals are always emitted as "<UPPERCASE letter><0|1>" (see
// components/shared/letters.ts + cylinderDouble/cylinderSingle's emitSignal calls), so the
// default here must match that case or a freshly-placed limit valve senses nothing at all.
const DEFAULT_SENSOR_KEY = 'A0';

export function createLimitValve32(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(
    compLayer,
    LIMIT_VALVE_32_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    '3/2 Limit',
    {
      x: SLIDING_VALVE_OFFSET_X,
      y: SLIDING_VALVE_OFFSET_Y,
      w: SLIDING_VALVE_W,
      h: SLIDING_VALVE_H,
    },
  );
  const valve = buildSlidingValve32Body(shell.svg, `arrow-limit-${uid()}`);

  // Roller + arms + spring, moving with the mover - matches the original app's roller-lever
  // limit-switch artwork. Coordinates are local to the mover, not the canvas.
  const rollerGroup = createSvgEl('g', { transform: `translate(-34, ${SLIDING_VALVE_H / 2})` });
  rollerGroup.appendChild(
    createSvgEl('path', { d: 'M -6 -7 L 35 -7', fill: 'none', stroke: '#111', 'stroke-width': 2 }),
  );
  rollerGroup.appendChild(
    createSvgEl('path', { d: 'M -6 7 L 35 7', fill: 'none', stroke: '#111', 'stroke-width': 2 }),
  );
  rollerGroup.appendChild(
    createSvgEl('circle', { cx: 4, cy: 0, r: 13, fill: '#fff', stroke: '#111', 'stroke-width': 2 }),
  );
  rollerGroup.appendChild(
    createSvgEl('circle', { cx: 4, cy: 0, r: 6, fill: '#fff', stroke: '#111', 'stroke-width': 2 }),
  );
  const sensorLabel = createSvgEl('text', {
    x: 4,
    y: -18,
    'text-anchor': 'middle',
    'font-size': 11,
  });
  sensorLabel.style.cursor = 'pointer';
  rollerGroup.appendChild(sensorLabel);

  const spring = createSvgEl('g', {
    transform: `translate(${SLIDING_VALVE_W}, ${SLIDING_VALVE_H / 2})`,
  });
  spring.appendChild(
    createSvgEl('path', { d: 'M 0 0 L 20 0', fill: 'none', stroke: '#111', 'stroke-width': 2 }),
  );
  spring.appendChild(
    createSvgEl('path', {
      d: 'M 20 0 l 10 -10 l 10 20 l 10 -20 l 10 20 l 10 -20 l 10 20',
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  valve.mover.append(rollerGroup, spring);

  let active = false;
  let sensorKey = DEFAULT_SENSOR_KEY;
  let manualActive = false;

  function updateLabel(): void {
    sensorLabel.textContent = sensorKey || '';
  }
  updateLabel();

  const comp: Component = {
    id: uid(),
    type: LIMIT_VALVE_32_TYPE,
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
      active = sensorKey ? getSignal(sensorKey) : manualActive;
      valve.setActive(active);
    },

    snapshot(): Record<string, unknown> {
      return { active, sensorKey };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
      sensorKey = data.sensorKey as string;
      updateLabel();
      valve.setActive(active);
    },
    reset(): void {
      active = false;
      manualActive = false;
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

  function promptBind(): void {
    const k = window.prompt('Enter sensor (e.g. A0, A1, B0, B1):', sensorKey || '');
    if (k === null) return;
    sensorKey = k.trim() || DEFAULT_SENSOR_KEY;
    updateLabel();
  }

  shell.el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    promptBind();
  });
  sensorLabel.addEventListener('click', (e) => {
    e.stopPropagation();
    promptBind();
  });

  valve.setActive(false);

  return comp;
}
