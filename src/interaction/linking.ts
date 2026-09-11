import type { Component, ComponentId, PortKey } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { createConnection } from '../wires/connection';
import { createSvgEl } from '../components/shared/svgHelpers';
import { pathFromPoints } from '../geometry/routing';
import { PORT_HOVER_RADIUS } from '../sim/constants';

interface PendingPort {
  compId: ComponentId;
  port: PortKey;
}

let pendingPort: PendingPort | null = null;
let previewPath: SVGPathElement | null = null;
let hoveredPortEl: SVGCircleElement | null = null;
let viewportRef: ViewportAdapter | null = null;

export function initLinking(
  connLayer: SVGSVGElement,
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
): void {
  viewportRef = viewport;
  previewPath = createSvgEl('path', { class: 'wireGhost', fill: 'none' });
  connLayer.appendChild(previewPath);

  workspaceEl.addEventListener('mousemove', (e) => {
    updateHover(e.clientX, e.clientY);
    updatePreview(e.clientX, e.clientY);
  });
}

function portWorldPos(comp: Component, portKey: PortKey): { x: number; y: number } {
  const port = comp.ports[portKey];
  const viewport = viewportRef;
  if (!port || !viewport) return { x: 0, y: 0 };
  const rect = port.el.getBoundingClientRect();
  return viewport.clientToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function updateHover(clientX: number, clientY: number): void {
  let nearest: SVGCircleElement | null = null;
  let nearestDist = PORT_HOVER_RADIUS;

  for (const c of appState.components) {
    for (const port of Object.values(c.ports)) {
      const rect = port.el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      if (dist <= nearestDist) {
        nearestDist = dist;
        nearest = port.el;
      }
    }
  }

  if (hoveredPortEl && hoveredPortEl !== nearest) {
    hoveredPortEl.classList.remove('portHover');
  }
  nearest?.classList.add('portHover');
  hoveredPortEl = nearest;
}

function updatePreview(clientX: number, clientY: number): void {
  if (!previewPath) return;
  if (!pendingPort || !viewportRef) {
    previewPath.setAttribute('d', '');
    return;
  }
  const comp = appState.findComponent(pendingPort.compId);
  if (!comp) return;
  const from = portWorldPos(comp, pendingPort.port);
  const to = viewportRef.clientToWorld(clientX, clientY);
  previewPath.setAttribute('d', pathFromPoints([from, to]));
}

export function isLinking(): boolean {
  return pendingPort !== null;
}

export function cancelLinking(): void {
  pendingPort = null;
  previewPath?.setAttribute('d', '');
}

export function handlePortClick(compId: ComponentId, port: PortKey): void {
  if (!pendingPort) {
    pendingPort = { compId, port };
    return;
  }

  if (pendingPort.compId === compId && pendingPort.port === port) {
    cancelLinking();
    return;
  }

  createConnection({ id: pendingPort.compId, port: pendingPort.port }, { id: compId, port });
  cancelLinking();
}

/** Wires every port on a component to feed clicks into the linking state machine. */
export function wireUpPortLinking(comp: Component): void {
  for (const port of Object.values(comp.ports)) {
    port.el.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePortClick(comp.id, port.key);
    });
  }
}
