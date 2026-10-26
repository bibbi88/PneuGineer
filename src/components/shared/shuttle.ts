import type { FlowConductivityContext, PortConnection } from '../../core/types';

/** How close, bar, the two inputs' pressures have to be to count as equal - the shuttle then
 * sits wherever it is and passes both. */
const EQUAL_BAND = 0.1;
/** Below this, bar, an input counts as vented. */
const VENTED_BAR = 0.2;

/**
 * Flow mode: the passages through a two-pressure (AND) valve, inputs A and B, output OUT. The
 * pressure in each input pushes the shuttle against that input's own seat, so the higher one
 * is shut off and OUT is open to the lower one - the output follows the lower input, and as
 * soon as either signal goes, OUT vents back out through that input. With both inputs equal
 * the shuttle passes both; with both vented, OUT can only let air out into them, so the first
 * input to rise doesn't slip a puff of air through before the shuttle has moved.
 */
export function andValveFlowRule(ctx: FlowConductivityContext): PortConnection[] {
  const pa = ctx.pressureAt('A');
  const pb = ctx.pressureAt('B');
  if (Math.abs(pa - pb) <= EQUAL_BAND) {
    if (Math.max(pa, pb) < VENTED_BAR) {
      return [
        { a: 'OUT', b: 'A', directed: true },
        { a: 'OUT', b: 'B', directed: true },
      ];
    }
    return [
      { a: 'A', b: 'OUT' },
      { a: 'B', b: 'OUT' },
    ];
  }
  return [{ a: pa < pb ? 'A' : 'B', b: 'OUT' }];
}

/**
 * Flow mode: the passages through a shuttle (OR) valve, inputs A and B, output OUT. The higher
 * input pressure pushes the shuttle over against the other input's seat, so OUT is open to the
 * higher one and the lower is shut off - and once both signals have gone, OUT vents back out
 * through whichever is open. With both inputs equal the shuttle passes both.
 */
export function orValveFlowRule(ctx: FlowConductivityContext): PortConnection[] {
  const pa = ctx.pressureAt('A');
  const pb = ctx.pressureAt('B');
  if (Math.abs(pa - pb) <= EQUAL_BAND) {
    return [
      { a: 'A', b: 'OUT' },
      { a: 'B', b: 'OUT' },
    ];
  }
  return [{ a: pa > pb ? 'A' : 'B', b: 'OUT' }];
}
