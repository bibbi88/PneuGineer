import type { ComponentBounds, PortDef, PortKey } from '../../core/types';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export interface ComponentShell {
  el: HTMLDivElement;
  svg: SVGSVGElement;
  labelEl: HTMLDivElement;
  setPos(x: number, y: number): void;
  getBounds(): ComponentBounds;
  setSelected(sel: boolean): void;
}

export function buildComponentShell(
  compLayer: HTMLElement,
  type: string,
  x: number,
  y: number,
  svgW: number,
  svgH: number,
  label: string,
): ComponentShell {
  const el = document.createElement('div');
  el.className = 'comp';
  el.dataset.type = type;

  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = label;
  el.appendChild(labelEl);

  const svg = createSvgEl('svg', { class: 'compSvg', width: svgW, height: svgH });
  svg.style.display = 'block';
  el.appendChild(svg);

  let cx = x;
  let cy = y;

  function setPos(nx: number, ny: number): void {
    cx = nx;
    cy = ny;
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
  }
  setPos(x, y);

  compLayer.appendChild(el);

  return {
    el,
    svg,
    labelEl,
    setPos,
    getBounds: () => ({ x: cx - svgW / 2, y: cy - svgH / 2, w: svgW, h: svgH }),
    setSelected: (sel: boolean) => el.classList.toggle('selected', sel),
  };
}

export function createPort(
  svg: SVGSVGElement,
  key: PortKey,
  cx: number,
  cy: number,
  entryOrientation: 'H' | 'V',
  opts: { isPilot?: boolean; pilotDir?: 1 | -1; radius?: number } = {},
): PortDef {
  const circle = createSvgEl('circle', { class: 'port', cx, cy, r: opts.radius ?? 5 });
  circle.dataset.port = key;
  svg.appendChild(circle);
  return {
    key,
    cx,
    cy,
    el: circle,
    entryOrientation,
    isPilot: opts.isPilot,
    pilotDir: opts.pilotDir,
  };
}
