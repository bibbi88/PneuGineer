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
  svg: SVGElement,
  key: PortKey,
  cx: number,
  cy: number,
  entryOrientation: 'H' | 'V',
  opts: { isPilot?: boolean; pilotDir?: 1 | -1; radius?: number } = {},
): PortDef {
  const circle = createSvgEl('circle', { class: 'port', cx, cy, r: opts.radius ?? 6 });
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

/** Port number/name label, matching the old app's convention of placing text just to the
 * side of the port dot rather than on top of it. */
export function createPortLabel(
  svg: SVGElement,
  cx: number,
  cy: number,
  text: string,
  opts: { anchor?: 'start' | 'middle' | 'end'; dx?: number; dy?: number; fontSize?: number } = {},
): SVGTextElement {
  const t = createSvgEl('text', {
    x: cx + (opts.dx ?? 0),
    y: cy + (opts.dy ?? 0),
    'text-anchor': opts.anchor ?? 'middle',
    'font-size': opts.fontSize ?? 11,
  });
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

/** A port dot plus its number label, positioned the way the old symbols did: label to the
 * left for a port whose wire leaves horizontally, above/below for one that leaves vertically. */
export function createLabeledPort(
  svg: SVGElement,
  key: PortKey,
  cx: number,
  cy: number,
  entryOrientation: 'H' | 'V',
  labelSide: 'left' | 'right' | 'above' | 'below',
  opts: { isPilot?: boolean; pilotDir?: 1 | -1; radius?: number; fontSize?: number } = {},
): PortDef {
  const port = createPort(svg, key, cx, cy, entryOrientation, opts);
  const labelPos: Record<
    typeof labelSide,
    { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }
  > = {
    left: { dx: -14, dy: 4, anchor: 'end' },
    right: { dx: 14, dy: 4, anchor: 'start' },
    above: { dx: 0, dy: -10, anchor: 'middle' },
    below: { dx: 0, dy: 18, anchor: 'middle' },
  };
  const p = labelPos[labelSide];
  createPortLabel(svg, cx, cy, key, {
    anchor: p.anchor,
    dx: p.dx,
    dy: p.dy,
    fontSize: opts.fontSize,
  });
  return port;
}

/** Arrowhead marker (matches the old app's ISO flow-direction arrows). Call once per SVG. */
export function addArrowMarker(svg: SVGSVGElement, id: string): void {
  const defs = createSvgEl('defs');
  const marker = createSvgEl('marker', {
    id,
    markerWidth: 10,
    markerHeight: 10,
    refX: 9,
    refY: 5,
    orient: 'auto',
  });
  const path = createSvgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#111' });
  marker.appendChild(path);
  defs.appendChild(marker);
  svg.appendChild(defs);
}

/** Arrowhead marker for lines with BOTH marker-start and marker-end (double-headed arrows).
 * Needs 'auto-start-reverse' so the start marker flips to point outward instead of also
 * pointing along the line's forward direction, which otherwise renders backwards/overlapping
 * arrowheads at the start of the line. */
export function addDoubleArrowMarker(svg: SVGSVGElement, id: string): void {
  const defs = createSvgEl('defs');
  const marker = createSvgEl('marker', {
    id,
    viewBox: '0 0 10 10',
    refX: 10,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: 'auto-start-reverse',
  });
  const path = createSvgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#111' });
  marker.appendChild(path);
  defs.appendChild(marker);
  svg.appendChild(defs);
}
