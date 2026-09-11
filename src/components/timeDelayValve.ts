import type { Component, PortConnection, SimStepContext } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const TIME_DELAY_VALVE_TYPE = 'timeDelayValve';

const SVG_W = 70;
const SVG_H = 50;
const DEFAULT_DELAY_SEC = 1.0;

/**
 * Pneumatic ON-delay timer: a 3/2 valve (ports 2/1/3) whose pilot (port 12) must stay
 * pressurized continuously for `delaySec` before it switches. It resets immediately
 * (spring return) the instant the pilot depressurizes.
 */
export function createTimeDelayValve(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, TIME_DELAY_VALVE_TYPE, x, y, SVG_W, SVG_H, '');

  shell.labelEl.textContent = '';
  const labelText = document.createElement('span');
  shell.labelEl.appendChild(labelText);

  const body = createSvgEl('rect', {
    x: 10,
    y: 10,
    width: SVG_W - 25,
    height: SVG_H - 20,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(body);

  const pilotTriangle = createSvgEl('polygon', {
    points: `${SVG_W - 15},${SVG_H / 2 - 8} ${SVG_W - 15},${SVG_H / 2 + 8} ${SVG_W - 3},${SVG_H / 2}`,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 1.5,
  });
  shell.svg.appendChild(pilotTriangle);

  const timerArc = createSvgEl('circle', {
    cx: SVG_W / 2 - 7,
    cy: 10,
    r: 4,
    fill: 'none',
    stroke: '#111',
    'stroke-width': 1.5,
  });
  shell.svg.appendChild(timerArc);

  const ports = {
    '2': createPort(shell.svg, '2', SVG_W / 2 - 7, 10, 'V'),
    '1': createPort(shell.svg, '1', SVG_W * 0.25, SVG_H - 10, 'V'),
    '3': createPort(shell.svg, '3', SVG_W * 0.55, SVG_H - 10, 'V'),
    '12': createPort(shell.svg, '12', SVG_W - 3, SVG_H / 2, 'H', { isPilot: true, pilotDir: 1 }),
  };

  let active = false;
  let timer = 0;
  let delaySec = DEFAULT_DELAY_SEC;

  function updateLabel(): void {
    labelText.textContent = `Delay ${delaySec.toFixed(1)}s`;
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
