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

  const graph = computeFrameGraph(
    appState.components,
    appState.connections,
    appState.topologyVersion,
  );

  for (const c of appState.components) {
    if (!c.onPressureChange) continue;
    const ctx: ConductivityContext = {
      isPressurized: (p) => graph.pressurized.has(portKey(c.id, p)),
    };
    c.onPressureChange(ctx);
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
