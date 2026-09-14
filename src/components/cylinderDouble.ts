import type { Component, SimStepContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createLabeledPort } from './shared/svgHelpers';
import { nextCylinderLetter, isCylinderLetterInUse } from './shared/letters';
import { BASE_CYL_SPEED } from '../sim/constants';
import { appState } from '../app/AppState';
import {
  isInSensorRange,
  defaultSensors,
  isValidSensorArray,
  relabelSensors,
  renameSensorKeyBindings,
  type CylinderSensor,
} from './shared/sensorPositions';

export const CYLINDER_DOUBLE_TYPE = 'cylinderDouble';

const SVG_W = 202;
const SVG_H = 84;
const GX = 8;
const GY = 8;
const W = 176;
const H = 56;
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
    { x: GX, y: GY, w: W, h: H },
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
  // Lead-in lines reaching the exact port centers (not just close to them), since a connected
  // port's own circle is hidden - any gap between the body and the port would otherwise show
  // up as a visible blank break in the wire.
  const leadA = createSvgEl('line', {
    x1: 10,
    y1: H,
    x2: 10,
    y2: H + PORT_MARGIN,
    stroke: '#111',
    'stroke-width': 2,
  });
  const leadB = createSvgEl('line', {
    x1: W - 10,
    y1: H,
    x2: W - 10,
    y2: H + PORT_MARGIN,
    stroke: '#111',
    'stroke-width': 2,
  });
  g.append(body, piston, rod, rodTip, leadA, leadB);
  shell.svg.appendChild(g);

  const ports = {
    A: createLabeledPort(g, 'A', 10, H + PORT_MARGIN, 'V', 'above'),
    B: createLabeledPort(g, 'B', W - 10, H + PORT_MARGIN, 'V', 'above'),
  };

  let pos = 0;
  let sensors: CylinderSensor[] = defaultSensors(letter);

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

      for (const sensor of sensors) {
        ctx.emitSignal(sensor.label, isInSensorRange(pos, sensor));
      }
    },

    snapshot(): Record<string, unknown> {
      return { pos, letter, sensors };
    },
    restore(data: Record<string, unknown>): void {
      pos = data.pos as number;
      letter = data.letter as string;
      sensors = isValidSensorArray(data.sensors) ? data.sensors : defaultSensors(letter);
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

    relabel(): void {
      const oldLetter = letter;
      letter = nextCylinderLetter();
      sensors = relabelSensors(sensors, oldLetter, letter).sensors;
      shell.labelEl.textContent = `Cylinder ${letter}`;
    },

    renameLabel(newValue: string): boolean {
      const trimmed = newValue.trim().toUpperCase();
      if (!/^[A-Z]$/.test(trimmed)) return false;
      if (trimmed !== letter && isCylinderLetterInUse(trimmed, comp.id)) return false;
      const oldLetter = letter;
      letter = trimmed;
      shell.labelEl.textContent = `Cylinder ${letter}`;

      // Carry each auto-named sensor's label forward (A0 -> B0, etc.) and, since that's the
      // exact key a limit switch's "Sensor key" points at, update every switch bound to the old
      // label so it keeps working instead of silently going dead once nothing emits that name.
      const { sensors: renamedSensors, renames } = relabelSensors(sensors, oldLetter, trimmed);
      sensors = renamedSensors;
      for (const r of renames) renameSensorKeyBindings(r.oldLabel, r.newLabel);
      appState.markDirty();
      return true;
    },
  };

  return comp;
}
