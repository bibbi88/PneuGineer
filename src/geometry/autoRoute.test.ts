import { describe, expect, it } from 'vitest';
import { autoRouteAStar } from './autoRoute';
import type { PortAnchor } from './routing';
import type { Component, ComponentBounds } from '../core/types';

function fakeComponent(id: number, bounds: ComponentBounds): Component {
  return {
    id,
    type: 'fake',
    el: document.createElement('div'),
    x: bounds.x + bounds.w / 2,
    y: bounds.y + bounds.h / 2,
    svgW: bounds.w,
    svgH: bounds.h,
    gx: 0,
    gy: 0,
    ports: {},
    conductivityRule: () => [],
    snapshot: () => ({}),
    restore: () => {},
    reset: () => {},
    setPos: () => {},
    getBounds: () => bounds,
    setSelected: () => {},
  };
}

describe('autoRouteAStar', () => {
  it('routes a simple straight line with no obstacles', () => {
    const from: PortAnchor = { pos: { x: 0, y: 0 }, entryOrientation: 'H' };
    const to: PortAnchor = { pos: { x: 200, y: 0 }, entryOrientation: 'H' };
    const points = autoRouteAStar(from, to, [], new Set());
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 200, y: 0 });
    // a clear straight shot should stay on one y value throughout
    expect(points.every((p) => p.y === 0)).toBe(true);
  });

  it('routes around an obstacle placed directly between the two ports', () => {
    const from: PortAnchor = { pos: { x: 0, y: 100 }, entryOrientation: 'H' };
    const to: PortAnchor = { pos: { x: 300, y: 100 }, entryOrientation: 'H' };
    const obstacle = fakeComponent(99, { x: 100, y: 50, w: 100, h: 100 });

    const points = autoRouteAStar(from, to, [obstacle], new Set());

    // the path must not pass through the obstacle's bounding box
    const passesThroughObstacle = points.some(
      (p) => p.x >= 100 && p.x <= 200 && p.y >= 50 && p.y <= 150,
    );
    expect(passesThroughObstacle).toBe(false);
    expect(points[0]).toEqual({ x: 0, y: 100 });
    expect(points[points.length - 1]).toEqual({ x: 300, y: 100 });
  });

  it('excludes the endpoints own components from obstacle marking', () => {
    const from: PortAnchor = { pos: { x: 10, y: 10 }, entryOrientation: 'H' };
    const to: PortAnchor = { pos: { x: 90, y: 10 }, entryOrientation: 'H' };
    const selfComp = fakeComponent(1, { x: 0, y: 0, w: 100, h: 20 });

    const points = autoRouteAStar(from, to, [selfComp], new Set([1]));
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toEqual({ x: 10, y: 10 });
  });
});
