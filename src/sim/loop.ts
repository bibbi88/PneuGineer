import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { stepSimulation } from './engine';
import { applyToDom } from './render';
import { emptyFrameGraph } from './pressure';
import { MAX_DT } from './constants';

let lastTime = performance.now();
let stepOnce = false;

export function requestSingleStep(): void {
  stepOnce = true;
}

function tick(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, MAX_DT);
  lastTime = now;

  if (appState.mode === Modes.PLAY || stepOnce) {
    const graph = stepSimulation(dt);
    applyToDom(graph);
    stepOnce = false;
  } else if (appState.mode === Modes.STOP) {
    applyToDom(emptyFrameGraph());
  }

  requestAnimationFrame(tick);
}

export function startSimLoop(): void {
  lastTime = performance.now();
  requestAnimationFrame(tick);
}
