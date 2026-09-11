import { appState } from '../app/AppState';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EXPORT_PADDING = 40;

function buildExportSvg(connLayer: SVGSVGElement): SVGSVGElement {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of appState.components) {
    const b = c.getBounds();
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 100;
  }
  minX -= EXPORT_PADDING;
  minY -= EXPORT_PADDING;
  maxX += EXPORT_PADDING;
  maxY += EXPORT_PADDING;
  const width = maxX - minX;
  const height = maxY - minY;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', String(minX));
  bg.setAttribute('y', String(minY));
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  for (const child of Array.from(connLayer.children)) {
    if (!(child instanceof SVGPathElement)) continue;
    if (child.classList.contains('wireHit') || child.classList.contains('wireGhost')) continue;
    const clone = child.cloneNode(true) as SVGPathElement;
    clone.setAttribute('stroke', '#000');
    clone.classList.remove('active', 'selected');
    svg.appendChild(clone);
  }

  for (const c of appState.components) {
    const inner = c.el.querySelector('svg');
    if (!inner) continue;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${c.getBounds().x}, ${c.getBounds().y})`);
    for (const child of Array.from(inner.children)) {
      const clone = child.cloneNode(true) as Element;
      clone.classList.remove('pressurized');
      g.appendChild(clone);
    }
    svg.appendChild(g);
  }

  return svg;
}

export function exportProjectAsSvg(name: string, connLayer: SVGSVGElement): void {
  const svg = buildExportSvg(connLayer);
  const serialized = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([serialized], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportProjectAsPng(name: string, connLayer: SVGSVGElement): Promise<void> {
  const svg = buildExportSvg(connLayer);
  const width = Number(svg.getAttribute('width'));
  const height = Number(svg.getAttribute('height'));
  const serialized = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

  const img = new Image();
  img.src = svgUrl;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.drawImage(img, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
