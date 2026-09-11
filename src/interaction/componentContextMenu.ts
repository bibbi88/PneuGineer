import type { Component } from '../core/types';
import { appState } from '../app/AppState';
import { canEdit } from '../app/modes';
import { showContextMenu } from './contextMenu';
import { redrawAllConnections } from '../wires/connection';
import { selectOnly } from './selection';

function rotateComponent(comp: Component, deltaDeg: number): void {
  const current = Number(comp.el.dataset.rot ?? '0');
  const next = (current + deltaDeg + 360) % 360;
  comp.el.dataset.rot = String(next);
  comp.el.style.transform = `translate(-50%, -50%) rotate(${next}deg)`;
}

export function wireUpComponentContextMenu(comp: Component): void {
  comp.el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit(appState.mode)) return;

    selectOnly(comp.id);
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Rotate ↻ Clockwise', onClick: () => rotateComponent(comp, 90) },
      { label: 'Rotate ↺ Counter-clockwise', onClick: () => rotateComponent(comp, -90) },
      {
        label: 'Delete',
        onClick: () => {
          appState.removeComponent(comp.id);
          redrawAllConnections();
        },
      },
    ]);
  });
}
