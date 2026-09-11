import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';

export const VALVE_52_TYPE = 'valve52';

const SVG_W = 90;
const SVG_H = 50;

export function createValve52(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, VALVE_52_TYPE, x, y, SVG_W, SVG_H, '5/2 Valve');

  const body = createSvgEl('rect', {
    x: 15,
    y: 10,
    width: SVG_W - 30,
    height: SVG_H - 20,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
    cursor: 'pointer',
  });
  shell.svg.appendChild(body);

  const ports = {
    '2': createPort(shell.svg, '2', SVG_W * 0.3, 10, 'V'),
    '4': createPort(shell.svg, '4', SVG_W * 0.7, 10, 'V'),
    '1': createPort(shell.svg, '1', SVG_W / 2, SVG_H - 10, 'V'),
    '3': createPort(shell.svg, '3', SVG_W * 0.2, SVG_H - 10, 'V'),
    '5': createPort(shell.svg, '5', SVG_W * 0.8, SVG_H - 10, 'V'),
    '12': createPort(shell.svg, '12', 15, SVG_H / 2, 'H', { isPilot: true, pilotDir: -1 }),
    '14': createPort(shell.svg, '14', SVG_W - 15, SVG_H / 2, 'H', { isPilot: true, pilotDir: 1 }),
  };

  let state: 0 | 1 = 0;
  let pilot12Prev = false;
  let pilot14Prev = false;

  const comp: Component = {
    id: uid(),
    type: VALVE_52_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return state === 0
        ? [
            { a: '1', b: '2' },
            { a: '4', b: '5' },
          ]
        : [
            { a: '1', b: '4' },
            { a: '2', b: '3' },
          ];
    },

    onPressureChange(ctx: ConductivityContext): void {
      const pilot12 = ctx.isPressurized('12');
      const pilot14 = ctx.isPressurized('14');
      if (pilot12 && !pilot12Prev) state = 1;
      if (pilot14 && !pilot14Prev) state = 0;
      pilot12Prev = pilot12;
      pilot14Prev = pilot14;
    },

    snapshot(): Record<string, unknown> {
      return { state };
    },
    restore(data: Record<string, unknown>): void {
      state = data.state as 0 | 1;
    },
    reset(): void {
      state = 0;
      pilot12Prev = false;
      pilot14Prev = false;
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  body.addEventListener('click', (e) => {
    if (appState.mode === Modes.STOP) return;
    e.stopPropagation();
    state = state === 0 ? 1 : 0;
  });

  return comp;
}
