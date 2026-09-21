import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { compileProgram, runScan, type CompiledProgram } from '../sim/plcProgram';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const PLC_TYPE = 'plc';

const W = 140;
const H = 180;
const BOX = { x: 30, y: 20, w: 80, h: 140 };
const ROWS = [40, 70, 100, 130];
const INPUTS = ['I0.0', 'I0.1', 'I0.2', 'I0.3'];
const OUTPUTS = ['Q0.0', 'Q0.1', 'Q0.2', 'Q0.3'];

const DEFAULT_PROGRAM = 'Q0.0 = (I0.0 | Q0.0) & !I0.1';

/**
 * A minimal simulated PLC: four digital inputs (an input reads true while its terminal is
 * connected to +24 V), four outputs (an output that's true drives its terminal to +24 V, so a
 * coil or lamp between it and 0 V energizes) and L+/M supply terminals - it only runs while L+ is
 * live and M is at 0 V. Logic is a few lines of boolean equations, see sim/plcProgram.ts.
 */
export function createPlc(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, PLC_TYPE, x, y, W, H, 'PLC', {
    x: BOX.x,
    y: BOX.y,
    w: BOX.w,
    h: BOX.h,
  });
  const svg = shell.svg;

  svg.append(
    createSvgEl('rect', {
      x: BOX.x,
      y: BOX.y,
      width: BOX.w,
      height: BOX.h,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  const title = createSvgEl('text', {
    x: W / 2,
    y: BOX.y + 12,
    'text-anchor': 'middle',
    'font-size': 11,
    'font-weight': 'bold',
    fill: '#111',
  });
  title.textContent = 'PLC';
  svg.appendChild(title);

  const ports: Component['ports'] = {};
  const outLabels = new Map<string, SVGTextElement>();
  const lead = (x1: number, y1: number, x2: number, y2: number): SVGLineElement =>
    createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': 2 });

  ports['L+'] = createPort(svg, 'L+', W / 2, 10, 'V', { electrical: true });
  ports['M'] = createPort(svg, 'M', W / 2, H - 10, 'V', { electrical: true });
  svg.append(lead(W / 2, 10, W / 2, BOX.y), lead(W / 2, BOX.y + BOX.h, W / 2, H - 10));
  const lplus = createSvgEl('text', { x: W / 2 + 8, y: 16, 'font-size': 10, fill: '#111' });
  lplus.textContent = 'L+';
  const mLabel = createSvgEl('text', { x: W / 2 + 8, y: H - 4, 'font-size': 10, fill: '#111' });
  mLabel.textContent = 'M';
  svg.append(lplus, mLabel);

  INPUTS.forEach((name, i) => {
    const cy = ROWS[i] as number;
    ports[name] = createPort(svg, name, 10, cy, 'H', { electrical: true });
    svg.append(lead(10, cy, BOX.x, cy));
    const t = createSvgEl('text', { x: BOX.x + 4, y: cy + 4, 'font-size': 10, fill: '#111' });
    t.textContent = name;
    svg.appendChild(t);
  });
  OUTPUTS.forEach((name, i) => {
    const cy = ROWS[i] as number;
    ports[name] = createPort(svg, name, W - 10, cy, 'H', { electrical: true });
    svg.append(lead(BOX.x + BOX.w, cy, W - 10, cy));
    const t = createSvgEl('text', {
      x: BOX.x + BOX.w - 4,
      y: cy + 4,
      'text-anchor': 'end',
      'font-size': 10,
      fill: '#111',
    });
    t.textContent = name;
    svg.appendChild(t);
    outLabels.set(name, t);
  });
  const errorEl = createSvgEl('text', {
    x: W / 2,
    y: BOX.y + BOX.h - 6,
    'text-anchor': 'middle',
    'font-size': 9,
    fill: '#c00',
  });
  svg.appendChild(errorEl);
  // Ports last so they paint (and take clicks) above the lead lines that end on them.
  for (const port of Object.values(ports)) svg.appendChild(port.el);

  let programText = DEFAULT_PROGRAM;
  let program: CompiledProgram = compileProgram(programText);
  let outputs = new Map<string, boolean>(OUTPUTS.map((n) => [n, false]));

  function refreshProgram(): void {
    program = compileProgram(programText);
    errorEl.textContent = program.error ? 'program error' : '';
  }
  function paintOutputs(): void {
    for (const [name, label] of outLabels) {
      const on = outputs.get(name) === true;
      label.setAttribute('fill', on ? '#c00' : '#111');
      label.setAttribute('font-weight', on ? 'bold' : 'normal');
    }
  }
  refreshProgram();
  paintOutputs();

  const comp: Component = {
    id: uid(),
    type: PLC_TYPE,
    el: shell.el,
    x,
    y,
    svgW: W,
    svgH: H,
    gx: 0,
    gy: 0,
    ports,
    electrical: {
      sources: () => OUTPUTS.filter((n) => outputs.get(n) === true),
      scan(isLive, isGround): boolean {
        const powered = isLive('L+') && isGround('M');
        const inputs = new Map(INPUTS.map((n) => [n, isLive(n)]));
        const next = powered
          ? runScan(program, inputs, outputs)
          : new Map(OUTPUTS.map((n) => [n, false]));
        let changed = false;
        for (const n of OUTPUTS) if (next.get(n) !== outputs.get(n)) changed = true;
        outputs = next;
        paintOutputs();
        return changed;
      },
    },
    conductivityRule: (): PortConnection[] => [],
    snapshot: () => ({
      program: programText,
      showName: shell.getNameVisible(),
      customName: shell.getCustomName(),
    }),
    restore(data: Record<string, unknown>): void {
      programText = (data.program as string) ?? DEFAULT_PROGRAM;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      refreshProgram();
    },
    reset(): void {
      outputs = new Map(OUTPUTS.map((n) => [n, false]));
      paintOutputs();
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
