import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';
import {
  buildSlidingValve32Body,
  SLIDING_VALVE_W,
  SLIDING_VALVE_H,
  SLIDING_VALVE_OFFSET_X,
  SLIDING_VALVE_OFFSET_Y,
} from './shared/slidingValve32';

export const AIR_VALVE_32_TYPE = 'airValve32';

// Extra right-side room for the spring symbol, beyond the offset already reserved on the left.
const SVG_W = SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W + 48;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 30;
// Local to the mover (not the outer canvas) - reparented into it, so it must use the mover's
// own coordinate system, matching SLIDING_VALVE_H rather than the padded outer SVG_H.
const PILOT_LOCAL = { cx: -40, cy: SLIDING_VALVE_H / 2 };

export function createAirValve32(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, AIR_VALVE_32_TYPE, x, y, SVG_W, SVG_H, '3/2 Air');
  const valve = buildSlidingValve32Body(shell.svg, `arrow-air-${uid()}`);

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

  // Pilot wall (inward triangle) + link + pilot port 14, all sliding with the mover - matches
  // the original app's air-piloted artwork. Coordinates are local to the mover, not the canvas.
  const pilotTriangle = createSvgEl('path', {
    d: `M -26 ${SLIDING_VALVE_H / 2 + 8} L -6 ${SLIDING_VALVE_H / 2} L -26 ${SLIDING_VALVE_H / 2 - 8} Z`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const pilotLink = createSvgEl('path', {
    d: `M -26 ${PILOT_LOCAL.cy} L ${PILOT_LOCAL.cx} ${PILOT_LOCAL.cy}`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const pilotLink2 = createSvgEl('path', {
    d: `M 0 ${PILOT_LOCAL.cy} L -6 ${PILOT_LOCAL.cy}`,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });
  const port14 = createPort(shell.svg, '14', PILOT_LOCAL.cx, PILOT_LOCAL.cy, 'H', {
    isPilot: true,
    pilotDir: -1,
  });
  valve.mover.append(pilotTriangle, pilotLink, pilotLink2, port14.el, spring);

  const ports = { ...valve.ports, '14': port14 };

  let active = false;

  const comp: Component = {
    id: uid(),
    type: AIR_VALVE_32_TYPE,
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

    onPressureChange(ctx: ConductivityContext): void {
      active = ctx.isPressurized('14');
      valve.setActive(active);
    },

    snapshot(): Record<string, unknown> {
      return { active };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
      valve.setActive(active);
    },
    reset(): void {
      active = false;
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
