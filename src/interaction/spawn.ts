import { createComponent, type ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from '../ui/viewport';
import type { Component } from '../core/types';
import { appState } from '../app/AppState';
import { makeDraggable } from './drag';
import { wireUpPortLinking } from './linking';
import { wireUpComponentContextMenu } from './componentContextMenu';

/** Creates a component of `type` and wires up every interaction hook it needs (drag, port
 * linking, right-click menu), then registers it in AppState. The one place both "add from
 * sidebar" and "load a project" should go through, so neither can forget a wiring step. */
export function spawnComponent(
  type: string,
  ctx: ComponentFactoryContext,
  viewport: ViewportAdapter,
  x: number,
  y: number,
): Component {
  const comp = createComponent(type, ctx, x, y);
  makeDraggable(comp, viewport);
  wireUpPortLinking(comp);
  wireUpComponentContextMenu(comp);
  appState.addComponent(comp);
  return comp;
}
