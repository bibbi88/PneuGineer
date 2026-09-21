import { appState } from '../app/AppState';
import { portKey, type FrameGraph } from './pressure';
import { SOURCE_PRESSURE } from './constants';
import { isElectricallyLive } from './electrical';

export function applyToDom(graph: FrameGraph): void {
  for (const c of appState.components) {
    for (const port of Object.values(c.ports)) {
      const active = graph.pressurized.has(portKey(c.id, port.key));
      port.el.classList.toggle('pressurized', active);
      port.el.setAttribute(
        'title',
        `${port.key}: ${active ? SOURCE_PRESSURE.toFixed(1) : '0.0'} bar`,
      );
    }
  }

  for (const conn of appState.connections) {
    const fromKey = portKey(conn.from.id, conn.from.port);
    const toKey = portKey(conn.to.id, conn.to.port);

    conn.pathEl.classList.toggle('live', isElectricallyLive(fromKey) && isElectricallyLive(toKey));

    const active = graph.pressurized.has(fromKey) && graph.pressurized.has(toKey);
    conn.pathEl.classList.toggle('active', active);
    conn.labelEl.textContent = active ? `${SOURCE_PRESSURE.toFixed(1)} bar` : '';

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
