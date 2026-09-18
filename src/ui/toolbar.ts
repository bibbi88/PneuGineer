import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { requestSingleStep } from '../sim/loop';
import { undo, redo, canUndo, canRedo, onHistoryChange } from '../history/historyStore';
import { redrawAllConnections } from '../wires/connection';
import { openTipsDialog } from './tipsDialog';

export function renderToolbar(container: HTMLElement): void {
  const playStopBtn = document.createElement('button');
  const pauseBtn = document.createElement('button');
  const stepBtn = document.createElement('button');
  const undoBtn = document.createElement('button');
  const redoBtn = document.createElement('button');
  const tipsBtn = document.createElement('button');

  for (const btn of [playStopBtn, pauseBtn, stepBtn, undoBtn, redoBtn, tipsBtn]) {
    btn.className = 'btn';
  }

  pauseBtn.textContent = '⏸ Pause';
  stepBtn.textContent = '⏭ Step';
  undoBtn.textContent = '↶ Undo';
  redoBtn.textContent = '↷ Redo';
  tipsBtn.textContent = '💡 Tips';
  tipsBtn.addEventListener('click', () => openTipsDialog());

  function updatePlayStopButton(): void {
    playStopBtn.textContent = appState.mode === Modes.PLAY ? '⏹ Stop' : '▶ Play';
  }
  updatePlayStopButton();

  playStopBtn.addEventListener('click', () => {
    const nextMode = appState.mode === Modes.PLAY ? Modes.STOP : Modes.PLAY;
    if (nextMode === Modes.STOP) {
      for (const c of appState.components) c.reset();
      // A component's own visual reset (e.g. the 5/2 valve's pilot ports sliding back to their
      // default position) doesn't go through any of the normal edit-time triggers that redraw
      // wires - without this, a wire attached to one of those ports stays stuck at wherever it
      // was mid-simulation instead of snapping back with it.
      redrawAllConnections();
    }
    appState.setMode(nextMode);
    updatePlayStopButton();
  });
  pauseBtn.addEventListener('click', () => {
    appState.setMode(Modes.PAUSE);
    updatePlayStopButton();
  });
  stepBtn.addEventListener('click', () => {
    appState.setMode(Modes.PAUSE);
    requestSingleStep();
    updatePlayStopButton();
  });
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  function updateUndoRedoButtons(): void {
    undoBtn.disabled = !canUndo();
    redoBtn.disabled = !canRedo();
  }
  onHistoryChange(updateUndoRedoButtons);
  updateUndoRedoButtons();

  container.append(playStopBtn, pauseBtn, stepBtn, undoBtn, redoBtn, tipsBtn);
}
