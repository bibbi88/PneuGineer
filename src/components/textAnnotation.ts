import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl } from './shared/svgHelpers';
import { appState } from '../app/AppState';
import { canEdit } from '../app/modes';

export const TEXT_ANNOTATION_TYPE = 'textAnnotation';

const DEFAULT_W = 180;
const DEFAULT_H = 70;
const DEFAULT_TEXT = 'Note';

/** A free-form text note for annotating the diagram - no ports, no simulation behavior, just a
 * draggable box with editable text (double-click to edit, matching the rename gesture already
 * used elsewhere, e.g. a cylinder's letter). */
export function createTextAnnotation(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(
    compLayer,
    TEXT_ANNOTATION_TYPE,
    x,
    y,
    DEFAULT_W,
    DEFAULT_H,
    '',
    { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H },
  );

  shell.svg.appendChild(
    createSvgEl('rect', {
      x: 0,
      y: 0,
      width: DEFAULT_W,
      height: DEFAULT_H,
      rx: 6,
      fill: '#fffce8',
      stroke: '#c9b45c',
      'stroke-width': 1.5,
      'stroke-dasharray': '4 3',
    }),
  );

  const textEl = document.createElement('div');
  textEl.className = 'annotationText';
  textEl.textContent = DEFAULT_TEXT;
  shell.el.appendChild(textEl);

  let text = DEFAULT_TEXT;

  function enterEditMode(): void {
    if (!canEdit(appState.mode)) return;
    textEl.contentEditable = 'true';
    textEl.classList.add('editing');
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function exitEditMode(): void {
    textEl.contentEditable = 'false';
    textEl.classList.remove('editing');
    text = textEl.textContent?.trim() || DEFAULT_TEXT;
    textEl.textContent = text;
    appState.markDirty();
  }

  textEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    enterEditMode();
  });
  textEl.addEventListener('blur', exitEditMode);
  textEl.addEventListener('keydown', (e) => {
    // Keeps Delete/Backspace/Escape from also being read by the global keyboard shortcuts
    // (delete-selected-component, cancel-linking) while actually typing into the note.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      textEl.blur();
    }
  });

  const comp: Component = {
    id: uid(),
    type: TEXT_ANNOTATION_TYPE,
    el: shell.el,
    x,
    y,
    svgW: DEFAULT_W,
    svgH: DEFAULT_H,
    gx: 0,
    gy: 0,
    ports: {},

    conductivityRule(): PortConnection[] {
      return [];
    },

    snapshot(): Record<string, unknown> {
      return { text };
    },
    restore(data: Record<string, unknown>): void {
      text = (data.text as string) || DEFAULT_TEXT;
      textEl.textContent = text;
    },
    reset(): void {},

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
