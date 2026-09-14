import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { requestSingleStep } from '../sim/loop';
import { undo, redo, canUndo, canRedo, onHistoryChange } from '../history/historyStore';

export function renderToolbar(container: HTMLElement): void {
  const playStopBtn = document.createElement('button');
  const pauseBtn = document.createElement('button');
  const stepBtn = document.createElement('button');
  const undoBtn = document.createElement('button');
  const redoBtn = document.createElement('button');

  for (const btn of [playStopBtn, pauseBtn, stepBtn, undoBtn, redoBtn]) {
    btn.className = 'btn';
  }

  pauseBtn.textContent = '⏸ Pause';
  stepBtn.textContent = '⏭ Step';
  undoBtn.textContent = '↶ Undo';
  redoBtn.textContent = '↷ Redo';

  function updatePlayStopButton(): void {
    playStopBtn.textContent = appState.mode === Modes.PLAY ? '⏹ Stop' : '▶ Play';
  }
  updatePlayStopButton();

  playStopBtn.addEventListener('click', () => {
    const nextMode = appState.mode === Modes.PLAY ? Modes.STOP : Modes.PLAY;
    if (nextMode === Modes.STOP) {
      for (const c of appState.components) c.reset();
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

  container.append(playStopBtn, pauseBtn, stepBtn, undoBtn, redoBtn);
}
