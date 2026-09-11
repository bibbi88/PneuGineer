import type { ViewportAdapter } from '../ui/viewport';
import { appState } from '../app/AppState';
import { createJunction } from '../components/junction';
import { createConnection, redrawConnection, setWireClickInterceptor } from '../wires/connection';
import { makeDraggable } from './drag';
import { wireUpPortLinking, handlePortClick, isLinking } from './linking';
import { wireUpComponentContextMenu } from './componentContextMenu';

/** Wires up "click on a wire while linking" to split it into a junction at that point. */
export function initWireSplitting(compLayer: HTMLElement, viewport: ViewportAdapter): void {
  setWireClickInterceptor((conn, clientX, clientY) => {
    if (!isLinking()) return false;

    const world = viewport.clientToWorld(clientX, clientY);
    const junction = createJunction(compLayer, world.x, world.y);
    appState.addComponent(junction);
    makeDraggable(junction, viewport);
    wireUpPortLinking(junction);
    wireUpComponentContextMenu(junction);

    const originalTo = conn.to;
    conn.to = { id: junction.id, port: 'P' };
    conn.guides = [];
    conn.stubStartLen = null;
    conn.stubEndLen = null;
    redrawConnection(conn);

    createConnection({ id: junction.id, port: 'P' }, originalTo);
    handlePortClick(junction.id, 'P');
    return true;
  });
}
