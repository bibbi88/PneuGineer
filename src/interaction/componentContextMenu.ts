import type { Component } from '../core/types';
import { appState } from '../app/AppState';
import { canEdit } from '../app/modes';
import { showContextMenu } from './contextMenu';
import { redrawAllConnections, removeComponentAndConnections } from '../wires/connection';
import { selectOnly, getSelectedComponents } from './selection';
import { copySelection } from './clipboard';

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

    // Right-clicking a component that's already part of a larger selection (e.g. from a
    // marquee) keeps that whole selection, so "Copy" below copies the group - only right-
    // clicking something outside the current selection narrows it to just that one.
    if (!appState.selectedComponents.has(comp.id)) selectOnly(comp.id);
    const selectionSize = getSelectedComponents().length;

    showContextMenu(e.clientX, e.clientY, [
      { label: 'Rotate ↻ Clockwise', onClick: () => rotateComponent(comp, 90) },
      { label: 'Rotate ↺ Counter-clockwise', onClick: () => rotateComponent(comp, -90) },
      {
        label: selectionSize > 1 ? `Copy (${selectionSize})` : 'Copy',
        onClick: () => copySelection(),
      },
      ...(comp.contextMenuItems?.() ?? []),
      {
        label: selectionSize > 1 ? `Delete (${selectionSize})` : 'Delete',
        onClick: () => {
          for (const c of getSelectedComponents()) removeComponentAndConnections(c.id);
          redrawAllConnections();
        },
      },
    ]);
  });
}
