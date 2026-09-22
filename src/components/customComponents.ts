import type { Component, PortConnection, PortDef, PortKey } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createPort } from './shared/svgHelpers';
import { sanitizeSvgMarkup } from './shared/svgSanitize';
import { componentRegistry, ComponentCategory, type RegistryEntry } from './registry';

/** One port a user has placed on a pasted SVG, in that SVG's own coordinate space. */
export interface CustomPortSpec {
  key: string;
  cx: number;
  cy: number;
  orientation: 'H' | 'V';
}

/** A user-authored component: raw (sanitized) SVG markup plus where its ports sit on it. `id`
 * doubles as the component's `type` string everywhere else in the app (registry key, saved
 * project `comps[].type`), always prefixed so it can never collide with a built-in type and so
 * other code can recognize "this is a user component" by the prefix alone. */
export interface CustomComponentDef {
  id: string;
  label: string;
  svgMarkup: string;
  width: number;
  height: number;
  ports: CustomPortSpec[];
}

export const CUSTOM_TYPE_PREFIX = 'custom:';

export function isCustomComponentType(type: string): boolean {
  return type.startsWith(CUSTOM_TYPE_PREFIX);
}

const STORAGE_KEY = 'pneugineer.customComponents';

function loadStoredDefs(): CustomComponentDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomComponentDef[]) : [];
  } catch {
    return [];
  }
}

function persistDefs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...customDefs.values()]));
  } catch {
    // A full/blocked localStorage shouldn't break custom components for the rest of this
    // session - they just won't be there to reload next time.
  }
}

const customDefs = new Map<string, CustomComponentDef>();
const changeListeners: Array<() => void> = [];

/** Called whenever a custom component is added, edited or removed (including the initial load
 * from storage), so e.g. the sidebar can re-render its library list. */
export function onCustomComponentsChange(cb: () => void): void {
  changeListeners.push(cb);
}
function notifyChange(): void {
  for (const cb of changeListeners) cb();
}

export function listCustomComponents(): CustomComponentDef[] {
  return [...customDefs.values()];
}

export function getCustomComponent(id: string): CustomComponentDef | undefined {
  return customDefs.get(id);
}

/** Every port on a custom component conducts to every other one - the closest thing to a
 * sensible default for arbitrary user artwork (a manifold/tee/gauge-with-passthrough), since
 * there's no way to ask a pasted SVG what its own internal plumbing should be. There's no way to
 * express one-way or switched behavior for a custom component yet. */
function allPortPairs(keys: string[]): PortConnection[] {
  const pairs: PortConnection[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      pairs.push({ a: keys[i] as PortKey, b: keys[j] as PortKey });
    }
  }
  return pairs;
}

function createCustomComponentInstance(
  def: CustomComponentDef,
  compLayer: HTMLElement,
  x: number,
  y: number,
): Component {
  const shell = buildComponentShell(compLayer, def.id, x, y, def.width, def.height, def.label);

  // Sanitized on every render (not just when the component was first saved) - see
  // shared/svgSanitize.ts's own doc for why a saved project file gets no more trust than a fresh
  // paste.
  const sanitized = sanitizeSvgMarkup(def.svgMarkup);
  if (sanitized) {
    for (const child of Array.from(sanitized.root.childNodes)) {
      shell.svg.appendChild(child);
    }
  }

  const ports: Record<string, PortDef> = {};
  for (const p of def.ports) {
    ports[p.key] = createPort(shell.svg, p.key, p.cx, p.cy, p.orientation);
  }
  const portKeys = def.ports.map((p) => p.key);

  const comp: Component = {
    id: uid(),
    type: def.id,
    el: shell.el,
    x,
    y,
    svgW: def.width,
    svgH: def.height,
    gx: 0,
    gy: 0,
    ports,

    conductivityRule: (): PortConnection[] => allPortPairs(portKeys),

    snapshot: () => ({
      showName: shell.getNameVisible(),
      customName: shell.getCustomName(),
    }),
    restore(data: Record<string, unknown>): void {
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
    },
    reset(): void {},

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };
  return comp;
}

function registryEntryFor(def: CustomComponentDef): RegistryEntry {
  return {
    factory: (ctx, x, y) => createCustomComponentInstance(def, ctx.compLayer, x, y),
    label: def.label,
    placeable: true,
    category: ComponentCategory.CUSTOM,
  };
}

/** Adds/updates a custom component in the live registry (so it can be placed and, if a saved
 * project references it, loaded) - does *not* persist or notify on its own, since a project load
 * registers many defs at once and only needs one save/notify at the end (see
 * persistence/project.ts's own loadProject). */
export function registerCustomComponent(def: CustomComponentDef): void {
  customDefs.set(def.id, def);
  componentRegistry.set(def.id, registryEntryFor(def));
}

/** Registers, persists to this browser's library, and notifies listeners - the one path the
 * custom-component editor dialog itself should go through. */
export function saveCustomComponent(def: CustomComponentDef): void {
  registerCustomComponent(def);
  persistDefs();
  notifyChange();
}

export function deleteCustomComponent(id: string): void {
  customDefs.delete(id);
  componentRegistry.delete(id);
  persistDefs();
  notifyChange();
}

/** Loads every custom component this browser already has saved into the live registry - called
 * once at startup, before the sidebar/any project first renders. */
export function initCustomComponents(): void {
  for (const def of loadStoredDefs()) registerCustomComponent(def);
}
