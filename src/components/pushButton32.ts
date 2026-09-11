import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const PUSH_BUTTON_32_TYPE = 'pushButton32';

const SVG_W = 60;
const SVG_H = 50;

export function createPushButton32(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, PUSH_BUTTON_32_TYPE, x, y, SVG_W, SVG_H, '3/2 Push');

  const body = createSvgEl('rect', {
    x: 10,
    y: 10,
    width: SVG_W - 20,
    height: SVG_H - 20,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
    cursor: 'pointer',
  });
  shell.svg.appendChild(body);

  const button = createSvgEl('circle', {
    cx: SVG_W / 2,
    cy: SVG_H / 2,
    r: 10,
    fill: '#eee',
    stroke: '#111',
    'stroke-width': 1.5,
    cursor: 'pointer',
  });
  shell.svg.appendChild(button);

  const ports = {
    '2': createPort(shell.svg, '2', SVG_W / 2, 10, 'V'),
    '1': createPort(shell.svg, '1', SVG_W * 0.3, SVG_H - 10, 'V'),
    '3': createPort(shell.svg, '3', SVG_W * 0.7, SVG_H - 10, 'V'),
  };

  let active = false;

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
    ports,

    conductivityRule(): PortConnection[] {
      return active ? [{ a: '2', b: '1' }] : [{ a: '2', b: '3' }];
    },

    snapshot(): Record<string, unknown> {
      return { active };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
    },
    reset(): void {
      active = false;
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  button.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    active = true;
    button.setAttribute('fill', '#cde');
  });
  const release = (): void => {
    active = false;
    button.setAttribute('fill', '#eee');
  };
  button.addEventListener('mouseup', release);
  button.addEventListener('mouseleave', release);

  return comp;
}
