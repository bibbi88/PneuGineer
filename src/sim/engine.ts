import type { ConductivityContext, SimStepContext } from '../core/types';
import { appState } from '../app/AppState';
import {
  computeFrameGraph,
  flowMultiplierToNearestSource,
  portKey,
  type FrameGraph,
} from './pressure';
import { getSignal, setSignal } from './signals';

export function stepSimulation(dt: number): FrameGraph {
  for (const c of appState.components) c.recompute?.();

  let graph = computeFrameGraph(appState.components, appState.connections, appState.topologyVersion);

  let anyEdgeTriggered = false;
  for (const c of appState.components) {
    if (!c.onPressureChange) continue;
    anyEdgeTriggered = true;
    const ctx: ConductivityContext = {
      isPressurized: (p) => graph.pressurized.has(portKey(c.id, p)),
    };
    c.onPressureChange(ctx);
  }

  // An edge-triggered component (e.g. a double-pilot 5/2 valve) may have just flipped its own
  // internal state based on the graph above and already updated its visual position - recompute
  // once more so the graph actually returned (what render.ts colors ports/wires from, and what
  // step() hooks like cylinder motion see) reflects that new state immediately, instead of
  // lagging one whole frame behind the position that's already on screen.
  if (anyEdgeTriggered) {
    graph = computeFrameGraph(appState.components, appState.connections, appState.topologyVersion);
  }

  for (const c of appState.components) {
    if (!c.step) continue;
    const ctx: SimStepContext = {
      dt,
      isPressurized: (p) => graph.pressurized.has(portKey(c.id, p)),
      flowMultiplierToNearestSource: (p) => flowMultiplierToNearestSource(graph, portKey(c.id, p)),
      emitSignal: setSignal,
      readSignal: getSignal,
    };
    c.step(dt, ctx);
  }

  return graph;
}
