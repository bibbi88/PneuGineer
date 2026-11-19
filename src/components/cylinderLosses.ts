/**
 * A cylinder's losses, given one of two ways (the inspector's "Losses given as"):
 * - 'friction': typical seal friction, worked out from the bore (as before this setting existed);
 * - 'efficiency': an efficiency η (%) - the seals take (1 − η) of the driving chamber's force,
 *   so the rod gives F = p·A·η (sim/flowModel.ts, sealFriction).
 * Older files have neither key and open with friction.
 */
export type LossMode = 'friction' | 'efficiency';

export const DEFAULT_EFFICIENCY_PCT = 100;
export const MIN_EFFICIENCY_PCT = 5;
export const MAX_EFFICIENCY_PCT = 100;

export interface CylinderLosses {
  lossMode: LossMode;
  efficiencyPct: number;
}

export function defaultLosses(): CylinderLosses {
  return { lossMode: 'friction', efficiencyPct: DEFAULT_EFFICIENCY_PCT };
}

/** The losses saved in `data`, falling back to `current` for anything missing or invalid. */
export function readLosses(data: Record<string, unknown>, current: CylinderLosses): CylinderLosses {
  const lossMode =
    data.lossMode === 'friction' || data.lossMode === 'efficiency'
      ? data.lossMode
      : current.lossMode;
  const n = Number(data.efficiencyPct);
  const efficiencyPct = Number.isFinite(n)
    ? Math.min(MAX_EFFICIENCY_PCT, Math.max(MIN_EFFICIENCY_PCT, n))
    : current.efficiencyPct;
  return { lossMode, efficiencyPct };
}

/** The piston's friction terms for the flow model: the typical seal friction `typical` (N), or
 * an efficiency instead. */
export function lossSpec(
  losses: CylinderLosses,
  typical: number,
): { friction: number; efficiency?: number } {
  return losses.lossMode === 'efficiency'
    ? { friction: 0, efficiency: losses.efficiencyPct / 100 }
    : { friction: typical };
}

/** The force the rod gives (N) for a net pressure force `net` (N), `chamber` being the larger
 * chamber's force: with an efficiency, less the seals' share (1 − η) of it - F = p·A·η for a
 * single driven chamber. With friction, the pressure force as it is (the force display has
 * always shown that). */
export function rodForce(losses: CylinderLosses, net: number, chamber = Math.abs(net)): number {
  if (losses.lossMode !== 'efficiency') return net;
  const loss = (1 - losses.efficiencyPct / 100) * Math.max(0, chamber);
  return Math.sign(net) * Math.max(0, Math.abs(net) - loss);
}
