import { createSvgEl, addArrowMarker, createLabeledPort } from './svgHelpers';
import { createSilencerSymbol, setSilencerState, type SilencerOption } from './silencer';
import type { PortDef } from '../../core/types';

export const SLIDING_VALVE_W = 140;
export const SLIDING_VALVE_H = 60;
/** Static placement of the whole symbol within its component canvas - large enough that every
 * variant's actuator extras (pilot ports, roller, spring) stay inside the canvas instead of
 * relying entirely on overflow:visible. */
export const SLIDING_VALVE_OFFSET_X = 54;
export const SLIDING_VALVE_OFFSET_Y = 34;

export interface SlidingValve32Body {
  /** Everything that slides sideways when the valve actuates - append actuator-specific
   * graphics (roller, rod, pilot triangle) here so they move with the rest of the symbol. */
  mover: SVGGElement;
  ports: { '1': PortDef; '2': PortDef; '3': PortDef };
  /** true = left cell (2->1, 3 blocked) sits under the ports; false = right cell (2->3, 1 blocked). */
  setActive(active: boolean): void;
  /** Port 3 is this valve family's exhaust - the one a silencer would actually be fitted to. */
  setSilencer(option: SilencerOption): void;
  getSilencer(): SilencerOption;
}

function tBlock(xCenter: number, yBar: number, yStemEnd: number): SVGGElement {
  const g = createSvgEl('g');
  g.appendChild(
    createSvgEl('path', {
      d: `M ${xCenter - 10} ${yBar} L ${xCenter + 10} ${yBar}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  g.appendChild(
    createSvgEl('path', {
      d: `M ${xCenter} ${yBar} L ${xCenter} ${yStemEnd}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  return g;
}

/** Shared body for the 3/2 "sliding mover" valve family (limit valve, push button, air-piloted
 * valve): a two-cell frame with a diagonal flow arrow + T-block (blocked port) symbol in each
 * cell, which slides sideways to swap which cell sits under the fixed 1/2/3 ports - matching the
 * original app's pushButton32/limitValve32/airValve32 artwork. */
export function buildSlidingValve32Body(svg: SVGSVGElement, arrowId: string): SlidingValve32Body {
  const W = SLIDING_VALVE_W;
  const H = SLIDING_VALVE_H;
  const midX = W / 2;
  addArrowMarker(svg, arrowId);

  const insetRight = Math.round((W - midX) * 0.25);
  const P2 = { cx: midX + insetRight, cy: -10 };
  const P1 = { cx: midX + insetRight, cy: H + 10 };
  const P3 = { cx: W - 12, cy: H + 10 };
  const L2 = { cx: insetRight, cy: P2.cy };
  const L1 = { cx: insetRight, cy: P1.cy };
  const L3 = { cx: midX - 12, cy: P3.cy };

  const mover = createSvgEl('g');

  const body = createSvgEl('rect', {
    x: 0,
    y: 0,
    width: W,
    height: H,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 2,
  });
  const boxLeft = createSvgEl('rect', {
    x: 0,
    y: 0,
    width: midX,
    height: H,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 1.6,
  });
  const boxRight = createSvgEl('rect', {
    x: midX,
    y: 0,
    width: midX,
    height: H,
    fill: '#fff',
    stroke: '#111',
    'stroke-width': 1.6,
  });

  const gLeft = createSvgEl('g');
  gLeft.appendChild(
    createSvgEl('path', {
      d: `M ${L1.cx} ${L1.cy - 10} L ${L2.cx} ${L2.cy + 10}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
      'marker-end': `url(#${arrowId})`,
    }),
  );
  gLeft.appendChild(tBlock(L3.cx, H - 18, L3.cy - 8));

  const gRight = createSvgEl('g');
  gRight.appendChild(
    createSvgEl('path', {
      d: `M ${P2.cx} ${P2.cy + 10} L ${P3.cx} ${P3.cy - 10}`,
      fill: 'none',
      stroke: '#111',
      'stroke-width': 2,
      'marker-end': `url(#${arrowId})`,
    }),
  );
  gRight.appendChild(tBlock(P1.cx, H - 18, P1.cy - 8));

  mover.append(body, boxLeft, boxRight, gLeft, gRight);
  svg.appendChild(mover);

  const ox = SLIDING_VALVE_OFFSET_X;
  const oy = SLIDING_VALVE_OFFSET_Y;

  // Fixed lead-in lines from the frame's top/bottom edge to each port's exact center (not just
  // close to it), since a connected port's own circle is hidden - any gap would otherwise show
  // up as a visible blank break in the wire. These stay outside the mover (like the ports
  // themselves): the frame always spans far enough horizontally in either slid position that a
  // vertical line at each port's fixed x still lands on the frame's top/bottom edge.
  svg.appendChild(
    createSvgEl('line', {
      x1: ox + P2.cx,
      y1: oy,
      x2: ox + P2.cx,
      y2: oy + P2.cy,
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  svg.appendChild(
    createSvgEl('line', {
      x1: ox + P1.cx,
      y1: oy + H,
      x2: ox + P1.cx,
      y2: oy + P1.cy,
      stroke: '#111',
      'stroke-width': 2,
    }),
  );
  svg.appendChild(
    createSvgEl('line', {
      x1: ox + P3.cx,
      y1: oy + H,
      x2: ox + P3.cx,
      y2: oy + P3.cy,
      stroke: '#111',
      'stroke-width': 2,
    }),
  );

  const ports = {
    '2': createLabeledPort(svg, '2', ox + P2.cx, oy + P2.cy, 'V', 'left'),
    '1': createLabeledPort(svg, '1', ox + P1.cx, oy + P1.cy, 'V', 'left'),
    '3': createLabeledPort(svg, '3', ox + P3.cx, oy + P3.cy, 'V', 'left'),
  };

  // Port 3 is this valve's exhaust - fixed in place (not part of the mover), so the silencer
  // attached to it stays put and simply moves with the whole component like everything else
  // drawn directly on `svg`. Defaults on, matching how these valves are conventionally fitted
  // in practice - most exhaust ports get a silencer unless there's a specific reason not to.
  let silencer3: SilencerOption = 'silencer';
  const silencer3El = createSilencerSymbol(ox + P3.cx, oy + P3.cy, 1);
  setSilencerState(ports['3'], silencer3El, silencer3);
  svg.appendChild(silencer3El);

  function setActive(active: boolean): void {
    mover.setAttribute('transform', `translate(${ox + (active ? midX : 0)}, ${oy})`);
  }

  function setSilencer(option: SilencerOption): void {
    silencer3 = option;
    setSilencerState(ports['3'], silencer3El, silencer3);
  }

  return { mover, ports, setActive, setSilencer, getSilencer: () => silencer3 };
}
