import type { ViewportAdapter } from '../ui/viewport';
import type { Component, PortKey } from '../core/types';

export function screenToWorld(
  viewport: ViewportAdapter,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return viewport.clientToWorld(cx, cy);
}

export function worldToScreen(
  viewport: ViewportAdapter,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const { scale, tx, ty } = viewport.getTransform();
  return { x: wx * scale + tx, y: wy * scale + ty };
}

/** Resolves a component port to world coordinates via its live DOM position. */
export function portGlobalPosition(
  viewport: ViewportAdapter,
  workspaceEl: HTMLElement,
  comp: Component,
  portKey: PortKey,
): { x: number; y: number } {
  const port = comp.ports[portKey];
  if (!port) return { x: comp.x, y: comp.y };

  const rect = port.el.getBoundingClientRect();
  const wsRect = workspaceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2 - wsRect.left;
  const cy = rect.top + rect.height / 2 - wsRect.top;
  const world = screenToWorld(viewport, cx + wsRect.left, cy + wsRect.top);
  return world;
}
