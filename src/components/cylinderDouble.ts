import type { Component, SimStepContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createLabeledPort } from './shared/svgHelpers';
import { nextCylinderLetter } from './shared/letters';
import { BASE_CYL_SPEED } from '../sim/constants';

export const CYLINDER_DOUBLE_TYPE = 'cylinderDouble';

const SVG_W = 246;
const SVG_H = 98;
const GX = 8;
const GY = 8;
const W = 220;
const H = 70;
const PORT_MARGIN = 6;

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
  const g = createSvgEl('g', { transform: `translate(${GX},${GY})` });

  const body = createSvgEl('rect', {
    x: 0,
    y: 0,
    width: W,
    height: H,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  const piston = createSvgEl('rect', { x: 60, y: 0, width: 6, height: H, fill: '#888' });
  const rod = createSvgEl('rect', { x: 66, y: H / 2 - 3, width: W - 66, height: 6, fill: '#888' });
  const rodTip = createSvgEl('rect', { x: W, y: H / 2 - 6, width: 10, height: 12, fill: '#666' });
  g.append(body, piston, rod, rodTip);
  shell.svg.appendChild(g);

  const ports = {
    A: createLabeledPort(g, 'A', 10, H + PORT_MARGIN, 'V', 'above'),
    B: createLabeledPort(g, 'B', W - 10, H + PORT_MARGIN, 'V', 'above'),
  };

  let pos = 0;

  function updateVisual(): void {
    const px = 10 + pos * (W - 20);
    piston.setAttribute('x', String(px));
    const rodX = px + 6;
    const tipX = px + (W - 10);
    rod.setAttribute('x', String(rodX));
    rod.setAttribute('width', String(Math.max(0, tipX - rodX)));
    rodTip.setAttribute('x', String(tipX));
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
    gx: GX,
    gy: GY,
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

  shell.labelEl.style.pointerEvents = 'auto';
  shell.labelEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const answer = window.prompt('Enter cylinder letter (A-Z):', letter);
    if (answer === null) return;
    const trimmed = answer.trim().toUpperCase();
    if (!/^[A-Z]$/.test(trimmed)) return;
    letter = trimmed;
    shell.labelEl.textContent = `Cylinder ${letter}`;
  });

  return comp;
}
