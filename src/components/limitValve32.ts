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
import { appState } from '../app/AppState';
import { isSensorKeyBoundElsewhere } from './shared/sensorPositions';

export const LIMIT_VALVE_32_TYPE = 'limitValve32';

// Extra right-side room for the spring symbol, beyond the offset already reserved on the left.
const SVG_W = SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W + 48;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 30;

export function createLimitValve32(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(
    compLayer,
    LIMIT_VALVE_32_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    '3/2 limit valve',
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

  const id = uid();

  let active = false;
  // A freshly placed limit switch starts unbound rather than defaulting to some sensor - every
  // new one used to default to the same fixed key (or, later, "whichever is free"), either of
  // which still means guessing at a binding you'd probably change anyway. Starting blank also
  // makes swapping two switches' labels possible without relocating either: clear one, give its
  // label to the other, then give the first one what's now free.
  let sensorKey = '';
  let manualActive = false;

  // Two limit switches sharing a sensor is allowed (a real circuit might legitimately fan one
  // signal out to several valves) rather than blocked, but it's easy to do by accident (e.g.
  // two switches both left at a stale default) - flagging it in red is a middle ground between
  // silently allowing it and refusing to let the assignment happen at all. Rechecked on every
  // appState change (not just this switch's own), since the conflict can appear or disappear
  // because of what some *other* switch just did.
  function updateLabel(): void {
    sensorLabel.textContent = sensorKey || '';
    const duplicate = sensorKey !== '' && isSensorKeyBoundElsewhere(sensorKey, id);
    sensorLabel.classList.toggle('sensorLabelDuplicate', duplicate);
  }
  updateLabel();
  appState.onChange(updateLabel);

  const comp: Component = {
    id,
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
      return {
        active,
        sensorKey,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3: valve.getSilencer(),
      };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
      sensorKey = data.sensorKey as string;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      valve.setSilencer((data.silencer3 as 'none' | 'silencer') ?? 'silencer');
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

  valve.setActive(false);

  return comp;
}
