import type { Component, PortConnection, SimStepContext } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';
import { flowThrough } from '../sim/flowNetwork';
import { toNormalLitresPerMinute } from '../sim/flowModel';

export const FLOW_METER_TYPE = 'flowMeter';

/** Inline, vertical like the other inline flow components (IN at the bottom, OUT at the top);
 * 60 wide with the ports on its center keeps IN/OUT on the 10px grid (see src/core/grid.ts). */
const LOCAL_W = 60;
const LOCAL_H = 80;
const PORT_X = LOCAL_W / 2;
const PORT_MARGIN = 10;
const RADIUS = 15;
const OX = 7;
const OY = 7;
/** Seconds over which the reading settles, so it can be read rather than flickering. */
const SMOOTHING = 0.15;
/** Below this, l/min, the meter reads zero - the residue of a line levelling out. */
const ZERO_BAND = 0.5;

/** Litres (ANR) per kg of air - the totaliser counts air the way consumption is quoted. */
const LITRES_PER_KG = toNormalLitresPerMinute(1) / 60;

function formatRate(lpm: number): string {
  if (Math.abs(lpm) < ZERO_BAND) return '0 l/min';
  const digits = Math.abs(lpm) < 10 ? 1 : 0;
  return `${lpm < 0 ? '−' : ''}${Math.abs(lpm).toFixed(digits)} l/min`;
}

function formatTotal(litres: number): string {
  return `Σ ${litres.toFixed(litres < 10 ? 2 : 1)} l`;
}

/**
 * A flow meter: put in a line, it shows the air passing through it in flow simulation mode -
 * the flow right now in l/min (ANR; negative when air flows from OUT to IN) and the total that
 * has passed since the simulation started, in litres, which gives the air used per cycle. It
 * barely restricts the line (its own flow rating is high). In logic mode there's no flow to
 * measure, so it shows nothing and simply passes the line through.
 *
 * Drawn as the measuring-instrument circle in line with the pipe, with the flow direction it
 * counts as positive marked inside.
 */
export function createFlowMeter(compLayer: HTMLElement, x: number, y: number): Component {
  const svgW = LOCAL_W + OX * 2;
  const svgH = LOCAL_H + OY * 2;
  const shell = buildComponentShell(compLayer, FLOW_METER_TYPE, x, y, svgW, svgH, 'Flow meter', {
    x: OX + PORT_X - RADIUS,
    y: OY + LOCAL_H / 2 - RADIUS,
    w: RADIUS * 2,
    h: RADIUS * 2,
  });

  const g = createSvgEl('g', { transform: `translate(${OX},${OY})` });
  const cy = LOCAL_H / 2;
  const bottomY = LOCAL_H - PORT_MARGIN;
  const topY = PORT_MARGIN;
  const line = (y1: number, y2: number): SVGElement =>
    createSvgEl('line', { x1: PORT_X, y1, x2: PORT_X, y2, stroke: '#111', 'stroke-width': 2 });
  g.append(
    line(bottomY, cy + RADIUS),
    line(cy - RADIUS, topY),
    createSvgEl('circle', {
      cx: PORT_X,
      cy,
      r: RADIUS,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
    // The flow direction read as positive: IN -> OUT.
    line(cy + 9, cy - 3),
    createSvgEl('path', {
      d: `M ${PORT_X} ${cy - 10} L ${PORT_X - 5} ${cy - 2} L ${PORT_X + 5} ${cy - 2} Z`,
      fill: '#111',
    }),
  );
  shell.svg.appendChild(g);

  const ports = {
    IN: createPort(g, 'IN', PORT_X, bottomY, 'V'),
    OUT: createPort(g, 'OUT', PORT_X, topY, 'V'),
  };

  const reading = document.createElement('div');
  reading.className = 'flowMeterReading';
  const rateEl = document.createElement('span');
  rateEl.className = 'flowMeterRate';
  const totalEl = document.createElement('span');
  totalEl.className = 'flowMeterTotal';
  reading.append(rateEl, totalEl);
  reading.style.display = 'none';
  shell.el.appendChild(reading);

  let smoothed = 0;
  let totalLitres = 0;

  function hide(): void {
    reading.style.display = 'none';
  }

  const comp: Component = {
    id: uid(),
    type: FLOW_METER_TYPE,
    el: shell.el,
    x,
    y,
    svgW,
    svgH,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule(): PortConnection[] {
      return [{ a: 'IN', b: 'OUT' }];
    },

    step(dt: number, ctx: SimStepContext): void {
      if (!ctx.flowMode) {
        hide();
        return;
      }
      const massFlow = flowThrough(comp.id, 'IN', 'OUT') ?? 0;
      totalLitres += Math.abs(massFlow) * dt * LITRES_PER_KG;
      smoothed += (massFlow - smoothed) * Math.min(1, dt / SMOOTHING);
      rateEl.textContent = formatRate(toNormalLitresPerMinute(smoothed));
      totalEl.textContent = formatTotal(totalLitres);
      reading.style.display = '';
    },

    snapshot(): Record<string, unknown> {
      return { showName: shell.getNameVisible(), customName: shell.getCustomName() };
    },
    restore(data: Record<string, unknown>): void {
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
    },
    reset(): void {
      smoothed = 0;
      totalLitres = 0;
      hide();
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
