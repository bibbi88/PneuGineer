import { describe, expect, it } from 'vitest';
import { createSource } from './source';
import { createCheckValve } from './checkValve';
import { createCylinderDouble } from './cylinderDouble';
import { createCylinderSingle } from './cylinderSingle';
import { createValve52 } from './valve52';
import { createPushButton32 } from './pushButton32';

function compLayer(): HTMLElement {
  return document.createElement('div');
}

describe('getBounds() reports the drawn body, not the padded canvas', () => {
  it('source: bounds are exactly the pressure-source circle', () => {
    const comp = createSource(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(30);
    expect(bounds.h).toBe(30);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('checkValve: bounds are exactly the (scaled-down) housing area', () => {
    const comp = createCheckValve(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(30);
    expect(bounds.h).toBe(30);
  });

  it('cylinderDouble: bounds match the (shrunk) body rectangle, not the padded canvas', () => {
    const comp = createCylinderDouble(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(176);
    expect(bounds.h).toBe(56);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('cylinderSingle: bounds match the (shrunk) body rectangle, not the padded canvas', () => {
    const comp = createCylinderSingle(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(160);
    expect(bounds.h).toBe(56);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('valve52: bounds match the housing, excluding the pilot-port padding', () => {
    const comp = createValve52(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(160);
    expect(bounds.h).toBe(60);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('pushButton32: bounds match the sliding-valve housing, excluding the spring/actuator padding', () => {
    const comp = createPushButton32(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(140);
    expect(bounds.h).toBe(60);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });
});
