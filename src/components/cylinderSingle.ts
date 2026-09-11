import type { Component, SimStepContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';
import { nextCylinderLetter } from './shared/letters';
import { BASE_CYL_SPEED } from '../sim/constants';
import { redrawAllConnections } from '../wires/connection';

export const CYLINDER_SINGLE_TYPE = 'cylinderSingle';

const SVG_W = 100;
const SVG_H = 30;
const BARREL_X = 20;
const BARREL_W = 50;
const ROD_MAX_EXTRA = 25;
const CAP_PORT_X = BARREL_X + 6;
const ROD_PORT_X = SVG_W - 6;

type CylinderMode = 'push' | 'pull';

export function createCylinderSingle(compLayer: HTMLElement, x: number, y: number): Component {
  let letter = nextCylinderLetter();
  const shell = buildComponentShell(compLayer, CYLINDER_SINGLE_TYPE, x, y, SVG_W, SVG_H, '');

  shell.labelEl.textContent = '';
  const labelText = document.createElement('span');
  shell.labelEl.appendChild(labelText);
  const modeBtn = document.createElement('button');
  modeBtn.style.fontSize = '10px';
  modeBtn.style.marginLeft = '4px';
  modeBtn.style.cursor = 'pointer';
  modeBtn.style.pointerEvents = 'auto';
  shell.labelEl.appendChild(modeBtn);

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
    A: createPort(shell.svg, 'A', CAP_PORT_X, SVG_H, 'V'),
  };

  let pos = 0;
  let mode: CylinderMode = 'push';
  let normallyExtended = false;

  function updateVisual(): void {
    const rodX = BARREL_X + BARREL_W + pos * ROD_MAX_EXTRA;
    rod.setAttribute('x2', String(rodX));
    piston.setAttribute('x', String(BARREL_X + 2 + pos * (BARREL_W - 8)));
  }
  updateVisual();

  function updateLabel(): void {
    labelText.textContent = `Cylinder ${letter} `;
    modeBtn.textContent = mode;
  }
  updateLabel();

  function targetFor(pressurizedA: boolean): number {
    const restTarget = normallyExtended ? 1 : 0;
    return mode === 'push' ? (pressurizedA ? 1 : restTarget) : pressurizedA ? 0 : restTarget;
  }

  const comp: Component = {
    id: uid(),
    type: CYLINDER_SINGLE_TYPE,
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
      const pressurizedA = ctx.isPressurized('A');
      const target = targetFor(pressurizedA);

      if (target !== pos) {
        const multiplier = pressurizedA ? ctx.flowMultiplierToNearestSource('A') : 1;
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
      return { pos, letter, mode, normallyExtended };
    },
    restore(data: Record<string, unknown>): void {
      pos = data.pos as number;
      letter = data.letter as string;
      mode = data.mode as CylinderMode;
      normallyExtended = data.normallyExtended as boolean;
      ports.A.el.setAttribute('cx', String(mode === 'push' ? CAP_PORT_X : ROD_PORT_X));
      updateLabel();
      updateVisual();
    },
    reset(): void {
      pos = normallyExtended ? 1 : 0;
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

  modeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mode = mode === 'push' ? 'pull' : 'push';
    normallyExtended = mode === 'pull';
    ports.A.el.setAttribute('cx', String(mode === 'push' ? CAP_PORT_X : ROD_PORT_X));
    updateLabel();
    redrawAllConnections();
  });

  return comp;
}
