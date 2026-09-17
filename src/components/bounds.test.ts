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

// buildComponentShell insets `innerBounds` by 2px on every side (BOUNDS_INSET in svgHelpers.ts),
// so getBounds() reports a box a little smaller than the component's own drawn body, not flush
// against its outline - these expected sizes are each component's drawn-body size minus 4 (2px
// off both width and height).
describe('getBounds() reports a box a little smaller than the drawn body, not the padded canvas', () => {
  it('source: bounds are inset from the pressure-source circle', () => {
    const comp = createSource(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(26);
    expect(bounds.h).toBe(26);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('checkValve: bounds are inset from the (scaled) housing area', () => {
    const comp = createCheckValve(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(36);
    expect(bounds.h).toBe(36);
  });

  it('cylinderDouble: bounds are inset from the (shrunk) body rectangle, not the padded canvas', () => {
    const comp = createCylinderDouble(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(172);
    expect(bounds.h).toBe(52);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('cylinderSingle: bounds are inset from the (shrunk) body rectangle, not the padded canvas', () => {
    const comp = createCylinderSingle(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(156);
    expect(bounds.h).toBe(52);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('valve52: bounds are inset from the housing, excluding the pilot-port padding', () => {
    const comp = createValve52(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(156);
    expect(bounds.h).toBe(56);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });

  it('pushButton32: bounds are inset from the sliding-valve housing, excluding the spring/actuator padding', () => {
    const comp = createPushButton32(compLayer(), 100, 100);
    const bounds = comp.getBounds();
    expect(bounds.w).toBe(136);
    expect(bounds.h).toBe(56);
    expect(bounds.w).toBeLessThan(comp.svgW);
    expect(bounds.h).toBeLessThan(comp.svgH);
  });
});
