import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appState } from '../app/AppState';
import { zoomToFit } from './zoomToFit';
import { createSource } from '../components/source';
import type { ViewportAdapter } from '../ui/viewport';

function compLayer(): HTMLElement {
  return document.createElement('div');
}

function fakeWorkspace(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  });
  return el;
}

describe('zoomToFit', () => {
  beforeEach(() => {
    appState.components = [];
  });

  it('does nothing on an empty canvas', () => {
    const setTransform = vi.fn();
    const viewport: ViewportAdapter = {
      clientToWorld: () => ({ x: 0, y: 0 }),
      applyTransform: () => {},
      getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
      setTransform,
      setGridVisible: () => {},
    };

    zoomToFit(viewport, fakeWorkspace(800, 600));
    expect(setTransform).not.toHaveBeenCalled();
  });

  it('centers the content bounds in the middle of the workspace', () => {
    const comp = createSource(compLayer(), 500, 500);
    appState.addComponent(comp);
    const b = comp.getBounds();
    const expectedCx = b.x + b.w / 2;
    const expectedCy = b.y + b.h / 2;

    let applied: { scale: number; tx: number; ty: number } | null = null;
    const viewport: ViewportAdapter = {
      clientToWorld: () => ({ x: 0, y: 0 }),
      applyTransform: () => {},
      getTransform: () => ({ scale: 1, tx: 0, ty: 0 }),
      setTransform: (scale, tx, ty) => {
        applied = { scale, tx, ty };
      },
      setGridVisible: () => {},
    };

    zoomToFit(viewport, fakeWorkspace(800, 600));

    if (!applied) throw new Error('setTransform was not called');
    const { scale, tx, ty } = applied;
    // The world point that should land at screen center (400, 300) is the content's own center.
    expect(tx + expectedCx * scale).toBeCloseTo(400);
    expect(ty + expectedCy * scale).toBeCloseTo(300);
  });
});
