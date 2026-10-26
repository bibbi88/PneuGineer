import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { stepSimulation } from './engine';
import { applyToDom } from './render';
import { emptyFrameGraph } from './pressure';
import { clearElectrical } from './electrical';
import { resetFlowNetwork } from './flowNetwork';
import { MAX_DT } from './constants';
import { redrawAllConnections } from '../wires/connection';
import { getSimSpeed } from '../app/simSpeed';

let lastTime = performance.now();
let stepOnce = false;

export function requestSingleStep(): void {
  stepOnce = true;
}

/** Simulated seconds for a frame that took `elapsed` real seconds: clamped first, so a slow or
 * backgrounded tab doesn't jump ahead, then scaled by the simulation speed - so slow motion and
 * fast forward reach everything that runs on time (cylinders, pressures, timers, the PLC).
 * Never negative: the browser's frame timestamps can repeat, or (on the first frame) come out
 * just before the time the loop started from. */
export function simulatedDt(elapsed: number): number {
  return Math.max(0, Math.min(elapsed, MAX_DT)) * getSimSpeed();
}

function tick(now: number): void {
  const dt = simulatedDt((now - lastTime) / 1000);
  lastTime = now;

  // A frame with no time in it (two with the same timestamp) has nothing to simulate - and a
  // zero time step is one the flow model can't take.
  if ((appState.mode === Modes.PLAY || stepOnce) && dt > 0) {
    const graph = stepSimulation(dt);
    applyToDom(graph);
    // A component can move its own ports in response to simulation state (e.g. the 5/2 valve's
    // sliding pilot ports) without going through any of the normal edit-time triggers that
    // redraw wires (drag, handle-drag, undo/redo) - so any wire attached to one would otherwise
    // stay stuck at its pre-slide path. Cheap even every frame: geometry is measured from live
    // DOM/cached per endpoint position, so nothing recomputes for a wire whose ports didn't move.
    redrawAllConnections();
    stepOnce = false;
  } else if (appState.mode === Modes.STOP) {
    clearElectrical();
    resetFlowNetwork();
    applyToDom(emptyFrameGraph());
  }

  requestAnimationFrame(tick);
}

export function startSimLoop(): void {
  lastTime = performance.now();
  requestAnimationFrame(tick);
}
