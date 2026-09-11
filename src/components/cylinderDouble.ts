import type { Component, SimStepContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';
import { nextCylinderLetter } from './shared/letters';
import { BASE_CYL_SPEED } from '../sim/constants';

export const CYLINDER_DOUBLE_TYPE = 'cylinderDouble';

const SVG_W = 100;
const SVG_H = 30;
const BARREL_X = 20;
const BARREL_W = 50;
const ROD_MAX_EXTRA = 25;

export function createCylinderDouble(compLayer: HTMLElement, x: number, y: number): Component {
  let letter = nextCylinderLetter();
  const shell = buildComponentShell(
    compLayer,
    CYLINDER_DOUBLE_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    `Cylinder ${letter}`,
  );

  const barrel = createSvgEl('rect', {
    x: BARREL_X,
    y: 4,
    width: BARREL_W,
    height: SVG_H - 8,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  shell.svg.appendChild(barrel);

  const rod = createSvgEl('line', {
    x1: BARREL_X + BARREL_W,
    y1: SVG_H / 2,
    x2: BARREL_X + BARREL_W,
    y2: SVG_H / 2,
    stroke: '#111',
    'stroke-width': 4,
  });
  shell.svg.appendChild(rod);

  const piston = createSvgEl('rect', {
    x: BARREL_X + 2,
    y: 8,
    width: 4,
    height: SVG_H - 16,
    fill: '#111',
  });
  shell.svg.appendChild(piston);

  const ports = {
    A: createPort(shell.svg, 'A', BARREL_X + 6, SVG_H, 'V'),
    B: createPort(shell.svg, 'B', SVG_W - 6, SVG_H, 'V'),
  };

  let pos = 0;

  function updateVisual(): void {
    const rodX = BARREL_X + BARREL_W + pos * ROD_MAX_EXTRA;
    rod.setAttribute('x2', String(rodX));
    piston.setAttribute('x', String(BARREL_X + 2 + pos * (BARREL_W - 8)));
  }
  updateVisual();

  const comp: Component = {
    id: uid(),
    type: CYLINDER_DOUBLE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return [];
    },

    step(dt: number, ctx: SimStepContext): void {
      const aPressurized = ctx.isPressurized('A');
      const bPressurized = ctx.isPressurized('B');

      let target = pos;
      let drivingPort: 'A' | 'B' | null = null;
      if (aPressurized && !bPressurized) {
        target = 1;
        drivingPort = 'A';
      } else if (bPressurized && !aPressurized) {
        target = 0;
        drivingPort = 'B';
      }

      if (drivingPort) {
        const multiplier = ctx.flowMultiplierToNearestSource(drivingPort);
        const dir = target > pos ? 1 : -1;
        const step = BASE_CYL_SPEED * multiplier * dt;
        pos += dir * Math.min(step, Math.abs(target - pos));
        pos = Math.max(0, Math.min(1, pos));
        updateVisual();
      }

      ctx.emitSignal(`${letter}0`, pos <= 0.02);
      ctx.emitSignal(`${letter}1`, pos >= 0.98);
    },

    snapshot(): Record<string, unknown> {
      return { pos, letter };
    },
    restore(data: Record<string, unknown>): void {
      pos = data.pos as number;
      letter = data.letter as string;
      shell.labelEl.textContent = `Cylinder ${letter}`;
      updateVisual();
    },
    reset(): void {
      pos = 0;
      updateVisual();
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
