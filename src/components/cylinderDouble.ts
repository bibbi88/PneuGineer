import type { Component, SimStepContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl, createPort } from './shared/svgHelpers';
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

export interface CylinderDoubleGeometry {
  svgW: number;
  svgH: number;
  gx: number;
  gy: number;
  w: number;
  h: number;
  portMargin: number;
  portInsetA: number;
  portInsetB: number;
  pistonWidth: number;
  pistonTravelInset: number;
  pistonToRodGap: number;
  rodHeight: number;
  rodTipInset: number;
  rodTipWidth: number;
  rodTipHeight: number;
}

export const CYLINDER_DOUBLE_DEFAULT_GEOMETRY: CylinderDoubleGeometry = {
  svgW: 202,
  svgH: 84,
  gx: 8,
  gy: 8,
  w: 176,
  h: 56,
  portMargin: 6,
  portInsetA: 10,
  portInsetB: 10,
  pistonWidth: 6,
  pistonTravelInset: 10,
  pistonToRodGap: 6,
  rodHeight: 6,
  rodTipInset: 10,
  rodTipWidth: 10,
  rodTipHeight: 12,
};

/** Piston/rod/tip x-layout for a given stroke position (0..1) - kept separate from the static
 * body draw so the live simulation can recompute it every frame without redrawing anything else. */
export function computeCylinderDoublePistonLayout(
  geo: CylinderDoubleGeometry,
  pos: number,
): { px: number; rodX: number; rodWidth: number; tipX: number } {
  const px = geo.pistonTravelInset + pos * (geo.w - geo.pistonTravelInset * 2);
  const rodX = px + geo.pistonToRodGap;
  const tipX = px + (geo.w - geo.rodTipInset);
  return { px, rodX, rodWidth: Math.max(0, tipX - rodX), tipX };
}

export function drawCylinderDoubleBody(
  g: SVGElement,
  geo: CylinderDoubleGeometry,
): {
  piston: SVGRectElement;
  rod: SVGRectElement;
  rodTip: SVGRectElement;
  a: { cx: number; cy: number };
  b: { cx: number; cy: number };
} {
  const body = createSvgEl('rect', {
    x: 0,
    y: 0,
    width: geo.w,
    height: geo.h,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  const layout = computeCylinderDoublePistonLayout(geo, 0);
  const piston = createSvgEl('rect', {
    x: layout.px,
    y: 0,
    width: geo.pistonWidth,
    height: geo.h,
    fill: '#888',
  });
  const rod = createSvgEl('rect', {
    x: layout.rodX,
    y: geo.h / 2 - geo.rodHeight / 2,
    width: layout.rodWidth,
    height: geo.rodHeight,
    fill: '#888',
  });
  const rodTip = createSvgEl('rect', {
    x: layout.tipX,
    y: geo.h / 2 - geo.rodTipHeight / 2,
    width: geo.rodTipWidth,
    height: geo.rodTipHeight,
    fill: '#666',
  });

  const A = { cx: geo.portInsetA, cy: geo.h + geo.portMargin };
  const B = { cx: geo.w - geo.portInsetB, cy: geo.h + geo.portMargin };
  // Lead-in lines reaching the exact port centers (not just close to them), since a connected
  // port's own circle is hidden - any gap between the body and the port would otherwise show
  // up as a visible blank break in the wire.
  const leadA = createSvgEl('line', {
    x1: A.cx,
    y1: geo.h,
    x2: A.cx,
    y2: A.cy,
    stroke: '#111',
    'stroke-width': 2,
  });
  const leadB = createSvgEl('line', {
    x1: B.cx,
    y1: geo.h,
    x2: B.cx,
    y2: B.cy,
    stroke: '#111',
    'stroke-width': 2,
  });
  g.append(body, piston, rod, rodTip, leadA, leadB);

  return { piston, rod, rodTip, a: A, b: B };
}

export function createCylinderDouble(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = CYLINDER_DOUBLE_DEFAULT_GEOMETRY;
  let letter = nextCylinderLetter();
  const shell = buildComponentShell(
    compLayer,
    CYLINDER_DOUBLE_TYPE,
    x,
    y,
    geo.svgW,
    geo.svgH,
    `Cylinder ${letter}`,
    { x: geo.gx, y: geo.gy, w: geo.w, h: geo.h },
  );
  const g = createSvgEl('g', { transform: `translate(${geo.gx},${geo.gy})` });
  const { piston, rod, rodTip, a: A, b: B } = drawCylinderDoubleBody(g, geo);
  shell.svg.appendChild(g);

  const ports = {
    A: createPort(g, 'A', A.cx, A.cy, 'V'),
    B: createPort(g, 'B', B.cx, B.cy, 'V'),
  };

  let pos = 0;
  let sensors: CylinderSensor[] = defaultSensors(letter);

  function updateVisual(): void {
    const layout = computeCylinderDoublePistonLayout(geo, pos);
    piston.setAttribute('x', String(layout.px));
    rod.setAttribute('x', String(layout.rodX));
    rod.setAttribute('width', String(layout.rodWidth));
    rodTip.setAttribute('x', String(layout.tipX));
  }
  updateVisual();

  const comp: Component = {
    id: uid(),
    type: CYLINDER_DOUBLE_TYPE,
    el: shell.el,
    x,
    y,
    svgW: geo.svgW,
    svgH: geo.svgH,
    gx: geo.gx,
    gy: geo.gy,
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
      return {
        pos,
        letter,
        sensors,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
      };
    },
    restore(data: Record<string, unknown>): void {
      pos = data.pos as number;
      letter = data.letter as string;
      sensors = isValidSensorArray(data.sensors) ? data.sensors : defaultSensors(letter);
      shell.setDefaultName(`Cylinder ${letter}`);
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
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
      shell.setDefaultName(`Cylinder ${letter}`);
    },

    renameLabel(newValue: string): boolean {
      const trimmed = newValue.trim().toUpperCase();
      if (!/^[A-Z]$/.test(trimmed)) return false;
      if (trimmed !== letter && isCylinderLetterInUse(trimmed, comp.id)) return false;
      const oldLetter = letter;
      letter = trimmed;
      shell.setDefaultName(`Cylinder ${letter}`);

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
