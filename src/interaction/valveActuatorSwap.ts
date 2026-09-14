import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from '../ui/viewport';
import type { Component } from '../core/types';
import { appState } from '../app/AppState';
import { spawnComponent } from './spawn';
import {
  createConnection,
  redrawConnection,
  removeComponentAndConnections,
} from '../wires/connection';
import { selectOnly } from './selection';

let ctxRef: ComponentFactoryContext | null = null;
let viewportRef: ViewportAdapter | null = null;

export function initValveActuatorSwap(
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
): void {
  ctxRef = ctx;
  viewportRef = viewport;
}

/**
 * Replaces `comp` with a fresh component of `newType` at the same position, reconnecting every
 * wire that touched it. Used to "convert" a 3/2 valve between push-button, limit-switch and
 * air-piloted actuation - they differ enough in behavior and artwork to stay separate component
 * types rather than one togglable mode, but all three come from `buildSlidingValve32Body` and so
 * share the same '1'/'2'/'3' port keys, which is what makes reconnecting most wires by port key
 * valid across the swap. The air-piloted variant also has a pilot port ('14') the other two
 * don't - a wire on that port is dropped rather than reconnected to a port that won't exist on
 * the new component, instead of silently becoming an invisible, un-removable connection with
 * nowhere valid to land.
 */
export function swapComponentType(comp: Component, newType: string): void {
  if (!ctxRef || !viewportRef) return;
  const { x, y } = comp;

  const related = appState.connections
    .filter((c) => c.from.id === comp.id || c.to.id === comp.id)
    .map((c) => ({
      from: c.from,
      to: c.to,
      guides: c.guides,
      stubStartLen: c.stubStartLen,
      stubEndLen: c.stubEndLen,
    }));

  appState.runSuppressed(() => {
    removeComponentAndConnections(comp.id);
    const next = spawnComponent(newType, ctxRef!, viewportRef!, x, y);

    for (const saved of related) {
      const fromMoved = saved.from.id === comp.id;
      const toMoved = saved.to.id === comp.id;
      // Only the end(s) that were actually on `comp` need to exist on `next` - the other end
      // belongs to some unrelated component (e.g. a source's own 'OUT' port) that the swap
      // never touched, so it's never in question here.
      if (fromMoved && !next.ports[saved.from.port]) continue;
      if (toMoved && !next.ports[saved.to.port]) continue;
      const from = fromMoved ? { id: next.id, port: saved.from.port } : saved.from;
      const to = toMoved ? { id: next.id, port: saved.to.port } : saved.to;
      const conn = createConnection(from, to);
      conn.guides = saved.guides;
      conn.stubStartLen = saved.stubStartLen;
      conn.stubEndLen = saved.stubEndLen;
      redrawConnection(conn);
    }

    selectOnly(next.id);
  });
}
