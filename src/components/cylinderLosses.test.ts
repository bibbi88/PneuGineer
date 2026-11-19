import { describe, expect, it } from 'vitest';
import { defaultLosses, lossSpec, readLosses, rodForce } from './cylinderLosses';
import { atRest, sealFriction, stepCylinder, type CylinderSpec } from '../sim/flowModel';

const P_ATM = 101325;

function spec(extra: Partial<CylinderSpec>): CylinderSpec {
  return {
    areaA: 0.000314,
    areaB: 0.000264,
    stroke: 0.1,
    mass: 1,
    load: 0,
    deadVolume: 4e-6,
    friction: 0,
    damping: 50,
    ...extra,
  };
}

describe('cylinder losses', () => {
  it('older files open with typical friction; efficiency defaults to 100 %', () => {
    const l = readLosses({}, defaultLosses());
    expect(l).toEqual({ lossMode: 'friction', efficiencyPct: 100 });
    expect(lossSpec(l, 42)).toEqual({ friction: 42 });
  });

  it('reads and clamps a saved efficiency', () => {
    const l = readLosses({ lossMode: 'efficiency', efficiencyPct: 250 }, defaultLosses());
    expect(l).toEqual({ lossMode: 'efficiency', efficiencyPct: 100 });
    expect(readLosses({ lossMode: 'bogus', efficiencyPct: 1 }, l)).toEqual({
      lossMode: 'efficiency',
      efficiencyPct: 5,
    });
    expect(lossSpec({ lossMode: 'efficiency', efficiencyPct: 90 }, 42)).toEqual({
      friction: 0,
      efficiency: 0.9,
    });
  });

  it('the seals take (1 − η) of the chamber force', () => {
    expect(sealFriction({ friction: 0, efficiency: 0.9 }, 1000)).toBeCloseTo(100);
    expect(sealFriction({ friction: 7 }, 1000)).toBe(7);
    expect(rodForce({ lossMode: 'efficiency', efficiencyPct: 90 }, 1000)).toBeCloseTo(900);
    expect(rodForce({ lossMode: 'efficiency', efficiencyPct: 90 }, -1000)).toBeCloseTo(-900);
    expect(rodForce({ lossMode: 'friction', efficiencyPct: 90 }, 1000)).toBe(1000);
  });

  it('a load the rod can hold at η = 100 % stalls it at a lower η', () => {
    // 6 bar on Ø20 mm: about 188 N. A 170 N load: moves at 100 %, held at 85 % (160 N).
    const supply = { kind: 'supply' as const, pressure: P_ATM + 6e5, conductance: 0.4 };
    const vent = { kind: 'exhaust' as const, conductance: 0.4 };
    const run = (efficiency: number): number => {
      const s = atRest();
      stepCylinder(s, spec({ load: 170, efficiency }), supply, vent, 3);
      return s.x;
    };
    expect(run(1)).toBeGreaterThan(0.05);
    expect(run(0.85)).toBe(0);
  });
});
