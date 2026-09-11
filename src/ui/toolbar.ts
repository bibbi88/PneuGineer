import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { requestSingleStep } from '../sim/loop';
import { undo, redo, canUndo, canRedo, onHistoryChange } from '../history/historyStore';

export function renderToolbar(container: HTMLElement): void {
  const playBtn = document.createElement('button');
  const pauseBtn = document.createElement('button');
  const stopBtn = document.createElement('button');
  const stepBtn = document.createElement('button');
  const undoBtn = document.createElement('button');
  const redoBtn = document.createElement('button');

  for (const btn of [playBtn, pauseBtn, stopBtn, stepBtn, undoBtn, redoBtn]) {
    btn.className = 'btn';
  }

  playBtn.textContent = '▶ Play';
  pauseBtn.textContent = '⏸ Pause';
  stopBtn.textContent = '⏹ Stop';
  stepBtn.textContent = '⏭ Step';
  undoBtn.textContent = '↶ Undo';
  redoBtn.textContent = '↷ Redo';

  playBtn.addEventListener('click', () => appState.setMode(Modes.PLAY));
  pauseBtn.addEventListener('click', () => appState.setMode(Modes.PAUSE));
  stopBtn.addEventListener('click', () => appState.setMode(Modes.STOP));
  stepBtn.addEventListener('click', () => {
    appState.setMode(Modes.PAUSE);
    requestSingleStep();
  });
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  function updateUndoRedoButtons(): void {
    undoBtn.disabled = !canUndo();
    redoBtn.disabled = !canRedo();
  }
  onHistoryChange(updateUndoRedoButtons);
  updateUndoRedoButtons();

  container.append(playBtn, pauseBtn, stopBtn, stepBtn, undoBtn, redoBtn);
}
