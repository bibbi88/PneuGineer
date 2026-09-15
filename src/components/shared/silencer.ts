import { createSvgEl } from './svgHelpers';
import type { PortDef } from '../../core/types';

export type SilencerOption = 'none' | 'silencer';

/** A small muffler symbol attached directly outside a port - drawn as part of the component's
 * own artwork rather than a separate wired component, so it moves with the valve automatically
 * and needs no wire of its own. `dir` is the direction (in local +y units) it extends away from
 * the port; starts hidden, toggled via its own `style.display`. Its wide mouth sits right at
 * the port, narrowing to a tip further away. */
export function createSilencerSymbol(cx: number, cy: number, dir: 1 | -1): SVGGElement {
  const g = createSvgEl('g', { class: 'silencerSymbol' });
  const len = 16;
  const halfWidth = 7;
  const tipY = cy + dir * len;

  g.appendChild(
    createSvgEl('polygon', {
      points: `${cx - halfWidth},${cy} ${cx + halfWidth},${cy} ${cx},${tipY}`,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 1.5,
    }),
  );

  const baffleFrac = 0.45;
  const baffleY = cy + dir * len * baffleFrac;
  const baffleHalf = halfWidth * (1 - baffleFrac);
  g.appendChild(
    createSvgEl('line', {
      x1: cx - baffleHalf,
      y1: baffleY,
      x2: cx + baffleHalf,
      y2: baffleY,
      stroke: '#111',
      'stroke-width': 1.5,
    }),
  );

  return g;
}

/** Keeps a port's own connector dot and a silencer's own symbol in sync with each other: a
 * silenced port is physically occupied by the muffler, so its connector dot hides (matching the
 * "hidden while connected" treatment a wired port already gets) and stops accepting clicks -
 * both wiring it and the port right-click menu's own "add pressure source" no longer make sense
 * once something is already attached there. */
export function setSilencerState(port: PortDef, symbol: SVGGElement, option: SilencerOption): void {
  const active = option === 'silencer';
  symbol.style.display = active ? '' : 'none';
  port.el.classList.toggle('portSilenced', active);
  port.el.style.pointerEvents = active ? 'none' : '';
}
