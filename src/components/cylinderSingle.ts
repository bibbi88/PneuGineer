import type { Component, SimStepContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';
import { nextCylinderLetter } from './shared/letters';
import { BASE_CYL_SPEED } from '../sim/constants';
import { redrawAllConnections } from '../wires/connection';

export const CYLINDER_SINGLE_TYPE = 'cylinderSingle';

const SVG_W = 186;
const SVG_H = 84;
const GX = 8;
const GY = 8;
const W = 160;
const H = 56;
const PORT_MARGIN = 6;
const CAP_PORT_X = 12;
const ROD_PORT_X = W - 12;

type CylinderMode = 'push' | 'pull';

export function createCylinderSingle(compLayer: HTMLElement, x: number, y: number): Component {
  let letter = nextCylinderLetter();
  const shell = buildComponentShell(compLayer, CYLINDER_SINGLE_TYPE, x, y, SVG_W, SVG_H, '', {
    x: GX,
    y: GY,
    w: W,
    h: H,
  });

  shell.labelEl.style.pointerEvents = 'auto';
  const labelText = document.createElement('span');
  const modeBtn = document.createElement('button');
  modeBtn.style.fontSize = '10px';
  modeBtn.style.marginLeft = '6px';
  modeBtn.style.padding = '2px 6px';
  modeBtn.style.borderRadius = '6px';
  modeBtn.style.cursor = 'pointer';
  modeBtn.style.pointerEvents = 'auto';
  modeBtn.title = 'Toggle single-acting mode (push/pull)';
  shell.labelEl.append(labelText, modeBtn);

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
  const piston = createSvgEl('rect', { x: 56, y: 0, width: 6, height: H, fill: '#888' });
  const rod = createSvgEl('rect', { x: 62, y: H / 2 - 3, width: W - 62, height: 6, fill: '#888' });
  const rodTip = createSvgEl('rect', { x: W, y: H / 2 - 6, width: 10, height: 12, fill: '#666' });

  // Spring symbol (right side, pushing the piston back when unpressurized).
  const springY = H / 2;
  const springX0 = W - 28;
  const seg = 10;
  const spring = createSvgEl('path', {
    d: [
      `M ${springX0} ${springY}`,
      `l ${-seg} ${-8}`,
      `l ${-seg} ${16}`,
      `l ${-seg} ${-16}`,
      `l ${-seg} ${16}`,
    ].join(' '),
    fill: 'none',
    stroke: '#111',
    'stroke-width': 2,
  });

  // Lead-in line reaching the exact port center (not just close to it), since a connected
  // port's own circle is hidden - any gap between the body and the port would otherwise show
  // up as a visible blank break in the wire. Repositioned in updatePortSide() when the port
  // moves between the cap and rod ends.
  const leadA = createSvgEl('line', {
    x1: CAP_PORT_X,
    y1: H,
    x2: CAP_PORT_X,
    y2: H + PORT_MARGIN,
    stroke: '#111',
    'stroke-width': 2,
  });
  g.append(body, piston, rod, rodTip, spring, leadA);
  shell.svg.appendChild(g);

  let mode: CylinderMode = 'push';
  const portACircle = createPort(g, 'A', CAP_PORT_X, H + PORT_MARGIN, 'V');
  const portALabel = createSvgEl('text', {
    x: CAP_PORT_X,
    y: H + PORT_MARGIN - 8,
    'text-anchor': 'middle',
    'font-size': 11,
  });
  portALabel.textContent = 'A';
  g.appendChild(portALabel);

  const ports = { A: portACircle };

  let pos = 0;
  let normallyExtended = false;

  function updateVisual(): void {
    const travelStart = 10;
    const travelEnd = W - 20;
    const px = travelStart + pos * (travelEnd - travelStart);
    piston.setAttribute('x', String(px));
    const rodX = px + 6;
    const tipX = px + (W - 10);
    rod.setAttribute('x', String(rodX));
    rod.setAttribute('width', String(Math.max(0, tipX - rodX)));
    rodTip.setAttribute('x', String(tipX));
  }
  updateVisual();

  function updateLabel(): void {
    labelText.textContent = `Cylinder ${letter} `;
    modeBtn.textContent = mode;
  }
  updateLabel();

  function updatePortSide(): void {
    const cx = mode === 'push' ? CAP_PORT_X : ROD_PORT_X;
    portACircle.el.setAttribute('cx', String(cx));
    portALabel.setAttribute('x', String(cx));
    leadA.setAttribute('x1', String(cx));
    leadA.setAttribute('x2', String(cx));
    ports.A.cx = cx;
  }
  updatePortSide();

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
    gx: GX,
    gy: GY,
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
      updatePortSide();
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
    updatePortSide();
    updateLabel();
    redrawAllConnections();
  });

  shell.labelEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const answer = window.prompt('Enter cylinder letter (A-Z):', letter);
    if (answer === null) return;
    const trimmed = answer.trim().toUpperCase();
    if (!/^[A-Z]$/.test(trimmed)) return;
    letter = trimmed;
    updateLabel();
  });

  return comp;
}
