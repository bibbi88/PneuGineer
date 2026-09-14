import { appState } from '../app/AppState';
import { canEdit } from '../app/modes';
import { getSelectedComponents, clearSelection } from './selection';
import {
  removeConnection,
  removeComponentAndConnections,
  redrawAllConnections,
} from '../wires/connection';
import { cancelLinking } from './linking';
import { GRID_SIZE } from '../core/grid';

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
}

function deleteSelection(): void {
  if (!canEdit(appState.mode)) return;

  for (const c of getSelectedComponents()) {
    removeComponentAndConnections(c.id);
  }
  if (appState.selectedConnectionId !== null) {
    removeConnection(appState.selectedConnectionId);
  }
  clearSelection();
  redrawAllConnections();
}

function nudgeSelection(dx: number, dy: number): void {
  if (!canEdit(appState.mode)) return;
  const selected = getSelectedComponents();
  if (selected.length === 0) return;
  for (const c of selected) c.setPos(c.x + dx, c.y + dy);
  redrawAllConnections();
}

export function initKeyboard(): void {
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(document.activeElement)) return;

    if (e.key === 'Escape') {
      cancelLinking();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelection();
      return;
    }

    const step = (e.shiftKey ? 10 : 1) * GRID_SIZE;
    if (e.key === 'ArrowLeft') nudgeSelection(-step, 0);
    else if (e.key === 'ArrowRight') nudgeSelection(step, 0);
    else if (e.key === 'ArrowUp') nudgeSelection(0, -step);
    else if (e.key === 'ArrowDown') nudgeSelection(0, step);
  });
}
