import { beforeEach, describe, expect, it } from 'vitest';
import {
  saveCustomComponent,
  deleteCustomComponent,
  listCustomComponents,
  getCustomComponent,
  isCustomComponentType,
  initCustomComponents,
  type CustomComponentDef,
} from './customComponents';
import { createComponent } from './registry';

const SIMPLE_SVG =
  '<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="0" y="0" width="100" height="60" fill="#fff" stroke="#111" /></svg>';

function makeDef(overrides: Partial<CustomComponentDef> = {}): CustomComponentDef {
  return {
    id: `custom:test-${Math.random()}`,
    label: 'Test widget',
    svgMarkup: SIMPLE_SVG,
    width: 100,
    height: 60,
    ports: [
      { key: 'A', cx: 0, cy: 30, orientation: 'H' },
      { key: 'B', cx: 100, cy: 30, orientation: 'H' },
      { key: 'C', cx: 50, cy: 0, orientation: 'V' },
    ],
    ...overrides,
  };
}

describe('customComponents', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const def of listCustomComponents()) deleteCustomComponent(def.id);
  });

  it('recognizes a custom type by its reserved prefix', () => {
    expect(isCustomComponentType('custom:abc')).toBe(true);
    expect(isCustomComponentType('checkValve')).toBe(false);
  });

  it('registers a saved component in the shared registry, placeable like any built-in type', () => {
    const def = makeDef();
    saveCustomComponent(def);

    const layer = document.createElement('div');
    const comp = createComponent(def.id, { compLayer: layer }, 0, 0);

    expect(comp.type).toBe(def.id);
    expect(Object.keys(comp.ports).sort()).toEqual(['A', 'B', 'C']);
  });

  it('connects every port to every other port (the only behavior a custom component has)', () => {
    const def = makeDef();
    saveCustomComponent(def);
    const comp = createComponent(def.id, { compLayer: document.createElement('div') }, 0, 0);

    const pairs = comp.conductivityRule({ isPressurized: () => false });
    const asSets = pairs.map((p) => [p.a, p.b].sort().join('-'));
    expect(asSets.sort()).toEqual(['A-B', 'A-C', 'B-C']);
  });

  it('writes a saved component to localStorage, for initCustomComponents() to reload on a real restart', () => {
    const def = makeDef();
    saveCustomComponent(def);

    const raw = localStorage.getItem('pneugineer.customComponents');
    const stored = raw ? (JSON.parse(raw) as CustomComponentDef[]) : [];
    expect(stored.find((d) => d.id === def.id)?.label).toBe('Test widget');
  });

  it('initCustomComponents() registers whatever is already in storage without duplicating it', () => {
    const def = makeDef();
    saveCustomComponent(def);

    initCustomComponents();
    initCustomComponents();

    expect(listCustomComponents().filter((d) => d.id === def.id)).toHaveLength(1);
  });

  it('deleteCustomComponent removes it from both the registry and storage', () => {
    const def = makeDef();
    saveCustomComponent(def);
    deleteCustomComponent(def.id);

    expect(getCustomComponent(def.id)).toBeUndefined();
    expect(() => createComponent(def.id, { compLayer: document.createElement('div') }, 0, 0)).toThrow();

    initCustomComponents();
    expect(getCustomComponent(def.id)).toBeUndefined();
  });

  it('saving with the same id again updates it in place rather than creating a second one', () => {
    const def = makeDef();
    saveCustomComponent(def);
    saveCustomComponent({ ...def, label: 'Renamed widget' });

    expect(listCustomComponents().filter((d) => d.id === def.id)).toHaveLength(1);
    expect(getCustomComponent(def.id)?.label).toBe('Renamed widget');
  });

  it('strips a <script> tag from the artwork actually rendered into the DOM', () => {
    const def = makeDef({
      svgMarkup:
        '<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="100" height="60" /><script>window.__pwned = true;</script></svg>',
    });
    saveCustomComponent(def);
    const comp = createComponent(def.id, { compLayer: document.createElement('div') }, 0, 0);

    expect(comp.el.querySelector('script')).toBeNull();
  });
});
