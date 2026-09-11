import type { Component } from '../core/types';
import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { canEdit } from '../app/modes';
import { snap } from '../core/grid';
import { getSelectedComponents, selectOnly } from './selection';
import { redrawAllConnections } from '../wires/connection';

export function makeDraggable(comp: Component, viewport: ViewportAdapter): void {
  comp.el.classList.add('draggable');

  comp.el.addEventListener('mousedown', (e: MouseEvent) => {
    if (!canEdit(appState.mode)) return;
    if (e.button !== 0) return;
    if ((e.target as Element).closest('.port')) return;

    if (!appState.selectedComponents.has(comp.id)) {
      selectOnly(comp.id);
    }

    const dragging = getSelectedComponents();
    const startWorld = viewport.clientToWorld(e.clientX, e.clientY);
    const origins = new Map(dragging.map((c) => [c.id, { x: c.x, y: c.y }]));

    e.preventDefault();
    e.stopPropagation();

    function onMove(ev: MouseEvent): void {
      const world = viewport.clientToWorld(ev.clientX, ev.clientY);
      const dx = world.x - startWorld.x;
      const dy = world.y - startWorld.y;
      for (const c of dragging) {
        const origin = origins.get(c.id);
        if (!origin) continue;
        c.setPos(snap(origin.x + dx), snap(origin.y + dy));
      }
      redrawAllConnections();
    }

    function onUp(): void {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}
