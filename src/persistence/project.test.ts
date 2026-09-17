import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '../app/AppState';
import { serializeProject, loadProject } from './project';
import { setComponentRotation } from '../interaction/componentContextMenu';
import { createSource, SOURCE_TYPE } from '../components/source';
import type { ComponentFactoryContext } from '../components/registry';
import type { ViewportAdapter } from '../ui/viewport';

function compLayer(): HTMLElement {
  return document.createElement('div');
}

const ctx: ComponentFactoryContext = { compLayer: compLayer() };
const viewport: ViewportAdapter = {
  clientToWorld: (cx, cy) => ({ x: cx, y: cy }),
  applyTransform: () => {},
  getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
  setTransform: () => {},
  setGridVisible: () => {},
};

describe('project rotation round-trip', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
  });

  it('serializeProject captures a component rotation set via the context menu', () => {
    const comp = createSource(compLayer(), 0, 0);
    appState.addComponent(comp);
    setComponentRotation(comp, 90);

    const file = serializeProject('test');
    expect(file.comps[0]?.rot).toBe(90);
  });

  it('serializeProject omits rotation as 0 for an unrotated component', () => {
    const comp = createSource(compLayer(), 0, 0);
    appState.addComponent(comp);

    const file = serializeProject('test');
    expect(file.comps[0]?.rot).toBe(0);
  });

  it('loadProject restores a saved rotation onto the newly spawned component', () => {
    const file = {
      schemaVersion: 1 as const,
      name: 'test',
      comps: [{ id: 1, type: SOURCE_TYPE, x: 0, y: 0, rot: 180, data: {} }],
      conns: [],
    };

    loadProject(file, ctx, viewport);

    expect(appState.components).toHaveLength(1);
    expect(appState.components[0]?.el.dataset.rot).toBe('180');
    expect(appState.components[0]?.el.style.transform).toContain('rotate(180deg)');
  });

  it('loadProject treats a missing rot as unrotated, for files saved before this field existed', () => {
    const file = {
      schemaVersion: 1 as const,
      name: 'test',
      comps: [{ id: 1, type: SOURCE_TYPE, x: 0, y: 0, data: {} }],
      conns: [],
    };

    loadProject(file, ctx, viewport);

    expect(appState.components[0]?.el.dataset.rot).toBeUndefined();
  });
});

describe('project title-block metadata round-trip', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.projectAuthor = '';
    appState.projectCheckedBy = '';
    appState.projectCompany = '';
  });

  it('serializeProject captures author/checkedBy/company from appState', () => {
    appState.projectAuthor = 'Jane';
    appState.projectCheckedBy = 'Alex';
    appState.projectCompany = 'Acme Pneumatics';

    const file = serializeProject('test');
    expect(file.meta).toEqual({
      author: 'Jane',
      checkedBy: 'Alex',
      company: 'Acme Pneumatics',
    });
  });

  it('loadProject restores saved meta onto appState', () => {
    const file = {
      schemaVersion: 1 as const,
      name: 'test',
      meta: { author: 'Jane', checkedBy: 'Alex', company: 'Acme Pneumatics' },
      comps: [],
      conns: [],
    };

    loadProject(file, ctx, viewport);

    expect(appState.projectAuthor).toBe('Jane');
    expect(appState.projectCheckedBy).toBe('Alex');
    expect(appState.projectCompany).toBe('Acme Pneumatics');
  });

  it('loadProject treats a missing meta as blank, for files saved before this field existed', () => {
    appState.projectAuthor = 'stale value from a previous project';
    const file = { schemaVersion: 1 as const, name: 'test', comps: [], conns: [] };

    loadProject(file, ctx, viewport);

    expect(appState.projectAuthor).toBe('');
    expect(appState.projectCheckedBy).toBe('');
    expect(appState.projectCompany).toBe('');
  });
});

describe('project page-frame round-trip', () => {
  beforeEach(() => {
    appState.components = [];
    appState.connections = [];
    appState.pageFrameSize = 'none';
    appState.pageFrameX = 0;
    appState.pageFrameY = 0;
  });

  it('serializeProject captures the current page frame size and position', () => {
    appState.pageFrameSize = 'a3';
    appState.pageFrameX = 120;
    appState.pageFrameY = -40;

    const file = serializeProject('test');
    expect(file.pageFrame).toEqual({ size: 'a3', x: 120, y: -40 });
  });

  it('loadProject restores the saved page frame onto appState', () => {
    const file = {
      schemaVersion: 1 as const,
      name: 'test',
      pageFrame: { size: 'a4' as const, x: 300, y: 150 },
      comps: [],
      conns: [],
    };

    loadProject(file, ctx, viewport);

    expect(appState.pageFrameSize).toBe('a4');
    expect(appState.pageFrameX).toBe(300);
    expect(appState.pageFrameY).toBe(150);
  });

  it('loadProject treats a missing pageFrame as none, for files saved before this field existed', () => {
    appState.pageFrameSize = 'a3';
    const file = { schemaVersion: 1 as const, name: 'test', comps: [], conns: [] };

    loadProject(file, ctx, viewport);

    expect(appState.pageFrameSize).toBe('none');
    expect(appState.pageFrameX).toBe(0);
    expect(appState.pageFrameY).toBe(0);
  });
});
