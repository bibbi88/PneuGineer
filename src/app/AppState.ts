import type { Component, ComponentId, Connection } from '../core/types';
import { Modes, type Mode } from './modes';

class AppState {
  components: Component[] = [];
  connections: Connection[] = [];
  selectedComponents = new Set<ComponentId>();
  selectedConnectionId: ComponentId | null = null;
  mode: Mode = Modes.STOP;
  /** Bumped whenever components/connections are added or removed, so cached graphs know to rebuild. */
  topologyVersion = 0;

  private changeListeners: Array<() => void> = [];
  private suppressed = false;

  /** Notified whenever the project's topology changes (add/remove component or wire). */
  onChange(cb: () => void): void {
    this.changeListeners.push(cb);
  }

  /**
   * Runs `fn` without firing onChange for each individual mutation inside it, then fires
   * exactly one notification afterward. Used by project load/undo/redo, which each make many
   * low-level component/connection mutations that should look like a single change to
   * subscribers (autosave, history) rather than one notification per mutation.
   */
  runSuppressed(fn: () => void): void {
    this.suppressed = true;
    try {
      fn();
    } finally {
      this.suppressed = false;
    }
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.suppressed) return;
    for (const cb of this.changeListeners) cb();
  }

  addComponent(c: Component): void {
    this.components.push(c);
    this.topologyVersion++;
    this.notifyChange();
  }

  removeComponent(id: ComponentId): void {
    const c = this.components.find((c) => c.id === id);
    c?.el.remove();
    c?.destroy?.();
    this.components = this.components.filter((c) => c.id !== id);
    this.selectedComponents.delete(id);
    this.topologyVersion++;
    this.notifyChange();
  }

  findComponent(id: ComponentId): Component | undefined {
    return this.components.find((c) => c.id === id);
  }

  addConnection(c: Connection): void {
    this.connections.push(c);
    this.topologyVersion++;
    this.notifyChange();
  }

  removeConnection(id: ComponentId): void {
    this.connections = this.connections.filter((c) => c.id !== id);
    if (this.selectedConnectionId === id) this.selectedConnectionId = null;
    this.topologyVersion++;
    this.notifyChange();
  }

  setMode(mode: Mode): void {
    this.mode = mode;
  }
}

export const appState = new AppState();
