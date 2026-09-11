import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { spawnComponent } from '../interaction/spawn';
import { createConnection, redrawAllConnections } from '../wires/connection';
import { clearSelection } from '../interaction/selection';
import { resetCylinderLetters } from '../components/shared/letters';
import { CURRENT_SCHEMA_VERSION, type ProjectFileV1 } from './schema';

export function serializeProject(name: string): ProjectFileV1 {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    comps: appState.components.map((c) => ({
      id: c.id,
      type: c.type,
      x: c.x,
      y: c.y,
      data: c.snapshot(),
    })),
    conns: appState.connections.map((c) => ({
      from: c.from,
      to: c.to,
      guides: c.guides,
      stubStartLen: c.stubStartLen,
      stubEndLen: c.stubEndLen,
    })),
  };
}

export function clearProject(): void {
  for (const conn of [...appState.connections]) {
    conn.pathEl.remove();
    conn.hitEl.remove();
    conn.labelEl.remove();
    appState.removeConnection(conn.id);
  }
  for (const comp of [...appState.components]) {
    appState.removeComponent(comp.id);
  }
  clearSelection();
  resetCylinderLetters();
}

export function loadProject(
  file: ProjectFileV1,
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
): void {
  appState.runSuppressed(() => {
    clearProject();

    const idMap = new Map<number, number>();
    for (const snap of file.comps) {
      const comp = spawnComponent(snap.type, ctx, viewport, snap.x, snap.y);
      comp.restore(snap.data);
      idMap.set(snap.id, comp.id);
    }

    for (const snap of file.conns) {
      const fromId = idMap.get(snap.from.id);
      const toId = idMap.get(snap.to.id);
      if (fromId === undefined || toId === undefined) continue;

      const conn = createConnection(
        { id: fromId, port: snap.from.port },
        { id: toId, port: snap.to.port },
      );
      conn.guides = snap.guides;
      conn.stubStartLen = snap.stubStartLen;
      conn.stubEndLen = snap.stubEndLen;
    }
  });

  redrawAllConnections();
}
