import { appState } from '../app/AppState';
import { portKey, pressureAt, type FrameGraph } from './pressure';
import { isElectricallyLive } from './electrical';
import { flowPressureAt } from './flowNetwork';

/** Gauge pressure below which a line in flow mode counts as empty (colouring, labels). */
const FLOW_ACTIVE_BAR = 0.1;

export function applyToDom(graph: FrameGraph): void {
  // In flow mode a line is "live" by the pressure actually in it (it fills and empties over
  // time); in logic mode by whether the graph connects it to a supply.
  const flow = appState.simulationMode === 'flow';
  const pressureOf = (key: string): number =>
    flow ? Math.max(0, flowPressureAt(key) ?? 0) : pressureAt(graph, key);
  const isActive = (key: string): boolean =>
    flow ? pressureOf(key) > FLOW_ACTIVE_BAR : graph.pressurized.has(key);

  for (const c of appState.components) {
    for (const port of Object.values(c.ports)) {
      const key = portKey(c.id, port.key);
      const active = isActive(key);
      port.el.classList.toggle('pressurized', active);
      // The pressure actually at this port, which a regulator upstream will have reduced.
      port.el.setAttribute(
        'title',
        `${port.key}: ${active ? pressureOf(key).toFixed(1) : '0.0'} bar`,
      );
    }
  }

  for (const conn of appState.connections) {
    const fromKey = portKey(conn.from.id, conn.from.port);
    const toKey = portKey(conn.to.id, conn.to.port);

    conn.pathEl.classList.toggle('live', isElectricallyLive(fromKey) && isElectricallyLive(toKey));

    const active = isActive(fromKey) && isActive(toKey);
    conn.pathEl.classList.toggle('active', active);
    // Both ends of a wire are the same node pneumatically, but the two can differ for one frame
    // while a change propagates - show the higher, so a freshly pressurized line doesn't
    // momentarily read as regulated when it isn't.
    const wirePressure = Math.max(pressureOf(fromKey), pressureOf(toKey));
    conn.labelEl.textContent = active ? `${wirePressure.toFixed(1)} bar` : '';

    const exhausting = graph.exhausting.has(fromKey) && graph.exhausting.has(toKey);
    conn.pathEl.classList.toggle('exhausting', exhausting);
    // The path is always drawn from `conn.from` to `conn.to` - flip the flow animation when air
    // is actually travelling the other way, so it always reads as moving out toward atmosphere
    // rather than (sometimes, depending on which end happened to get wired as "from") backward.
    const fromDepth = graph.exhaustDepth.get(fromKey) ?? 0;
    const toDepth = graph.exhaustDepth.get(toKey) ?? 0;
    conn.pathEl.classList.toggle('exhausting-reverse', exhausting && fromDepth > toDepth);
  }
}
