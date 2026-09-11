import { appState } from '../app/AppState';
import { portKey, type FrameGraph } from './pressure';
import { SOURCE_PRESSURE } from './constants';

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
    const active =
      graph.pressurized.has(portKey(conn.from.id, conn.from.port)) &&
      graph.pressurized.has(portKey(conn.to.id, conn.to.port));
    conn.pathEl.classList.toggle('active', active);
    conn.labelEl.textContent = active ? `${SOURCE_PRESSURE.toFixed(1)} bar` : '';
  }
}
