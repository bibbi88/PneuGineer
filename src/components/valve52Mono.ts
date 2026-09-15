import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import {
  buildComponentShell,
  createSvgEl,
  createPort,
  createLabeledPort,
  createPortLabel,
  addDoubleArrowMarker,
} from './shared/svgHelpers';
import { createSilencerSymbol, setSilencerState, type SilencerOption } from './shared/silencer';

export const VALVE_52_MONO_TYPE = 'valve52Mono';

// Same two-cell sliding housing as the bistable 5/2 valve (valve52.ts), used as the base here -
// only pilot 12 and its side of the artwork differ: a spring (copied from the 3/2 valve
// family's own spring symbol) takes its place, and there's only the one pilot port left to
// drive the valve, so it's spring-return rather than holding whichever state it was last
// pushed to.
const W0 = 80;
const H0 = 60;
const BODY_W = W0 * 2;
const BODY_H = H0;
const GX0 = 115;
const GY0 = 24;
const SVG_W = BODY_W + 110;
const SVG_H = BODY_H + 49;
const STROKE = 2;
const FONT = 10;
const TRI_H = BODY_H / 4;
const TRI_W = TRI_H * 1.2;
const TRI_GAP = 7;
const PILOT_PORT_OFFSET = 24;
const PILOT_CY = H0 / 2;
const PORT14_LOCAL_X = -15 - PILOT_PORT_OFFSET;

function addDoubleArrow(
  parent: SVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  arrowId: string,
): void {
  parent.appendChild(
    createSvgEl('line', {
      x1,
      y1,
      x2,
      y2,
      stroke: '#111',
      'stroke-width': STROKE,
      'marker-start': `url(#${arrowId})`,
      'marker-end': `url(#${arrowId})`,
    }),
  );
}

export function createValve52Mono(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(
    compLayer,
    VALVE_52_MONO_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    '5/2 valve, monostable',
    { x: GX0 - W0, y: GY0, w: BODY_W, h: BODY_H },
  );
  const svg = shell.svg;
  svg.style.overflow = 'visible';

  const arrowId = `arrow-v52m-${uid()}`;
  addDoubleArrowMarker(svg, arrowId);

  const gInner = createSvgEl('g');

  const gSlide = createSvgEl('g');
  const cell0 = createSvgEl('g');
  cell0.appendChild(
    createSvgEl('rect', {
      x: 0,
      y: 0,
      width: W0,
      height: H0,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );
  addDoubleArrow(cell0, W0 / 2, H0, 10, 0, arrowId);
  addDoubleArrow(cell0, W0 - 10, 0, W0 - 10, H0, arrowId);

  const cell1 = createSvgEl('g', { transform: `translate(${W0},0)` });
  cell1.appendChild(
    createSvgEl('rect', {
      x: 0,
      y: 0,
      width: W0,
      height: H0,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );
  addDoubleArrow(cell1, W0 / 2, H0, W0 - 10, 0, arrowId);
  addDoubleArrow(cell1, 10, 0, 10, H0, arrowId);

  // The spring (same symbol as the 3/2 push-button/air-piloted valves' own spring) sits where
  // the second pilot used to be, sliding with the two-cell picture just like theirs slides with
  // the mover - representing the spring compressing/extending as the valve shifts.
  const spring = createSvgEl('g', { transform: `translate(${BODY_W},${PILOT_CY})` });
  spring.appendChild(
    createSvgEl('path', {
      d: 'M 0 0 L 20 0',
      fill: 'none',
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );
  spring.appendChild(
    createSvgEl('path', {
      d: 'M 20 0 l 10 -10 l 10 20 l 10 -20',
      fill: 'none',
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );

  gSlide.append(cell0, cell1, spring);

  function addTriangleAndWallLine(parent: SVGElement): void {
    const tipX = -TRI_GAP;
    const points = [
      [tipX, PILOT_CY],
      [tipX - TRI_W, PILOT_CY - TRI_H / 2],
      [tipX - TRI_W, PILOT_CY + TRI_H / 2],
    ];
    parent.appendChild(
      createSvgEl('polygon', {
        points: points.map((p) => p.join(',')).join(' '),
        fill: 'none',
        stroke: '#111',
        'stroke-width': STROKE,
      }),
    );
    parent.appendChild(
      createSvgEl('line', {
        x1: tipX,
        y1: PILOT_CY,
        x2: 0,
        y2: PILOT_CY,
        stroke: '#111',
        'stroke-width': STROKE,
      }),
    );
  }

  const gP14 = createSvgEl('g');
  addTriangleAndWallLine(gP14);

  // Reaches the pilot port's exact center (not just close to it, which is what a visible port
  // circle would otherwise be relied on to bridge) - since a connected port's own circle is
  // hidden, any gap here would show up as a visible blank break in the wire.
  gP14.appendChild(
    createSvgEl('line', {
      x1: PORT14_LOCAL_X,
      y1: PILOT_CY,
      x2: -TRI_GAP - TRI_W,
      y2: PILOT_CY,
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );

  const port14 = createPort(svg, '14', PORT14_LOCAL_X, PILOT_CY, 'H', {
    isPilot: true,
    pilotDir: -1,
  });
  port14.el.setAttribute('r', '6');
  const label14 = createSvgEl('text', {
    x: PORT14_LOCAL_X,
    y: PILOT_CY - 10,
    'text-anchor': 'middle',
    'font-size': FONT,
  });
  label14.textContent = '14';
  gP14.append(port14.el, label14);

  gInner.append(gSlide, gP14);
  svg.appendChild(gInner);

  const fixedPortsLocal = {
    '4': { cx: 10, cy: -10 },
    '2': { cx: W0 - 10, cy: -10 },
    '5': { cx: 10, cy: H0 + 10 },
    '1': { cx: W0 / 2, cy: H0 + 10 },
    '3': { cx: W0 - 10, cy: H0 + 10 },
  } as const;

  for (const key of ['4', '2'] as const) {
    const p = fixedPortsLocal[key];
    svg.appendChild(
      createSvgEl('line', {
        x1: GX0 + p.cx,
        y1: GY0,
        x2: GX0 + p.cx,
        y2: GY0 + p.cy,
        stroke: '#111',
        'stroke-width': STROKE,
      }),
    );
  }
  for (const key of ['5', '1', '3'] as const) {
    const p = fixedPortsLocal[key];
    svg.appendChild(
      createSvgEl('line', {
        x1: GX0 + p.cx,
        y1: GY0 + H0,
        x2: GX0 + p.cx,
        y2: GY0 + p.cy,
        stroke: '#111',
        'stroke-width': STROKE,
      }),
    );
  }

  function tightLeftLabeledPort(key: '5' | '1' | '3'): ReturnType<typeof createPort> {
    const p = fixedPortsLocal[key];
    const px = GX0 + p.cx;
    const py = GY0 + p.cy;
    const port = createPort(svg, key, px, py, 'V');
    createPortLabel(svg, px, py, key, { anchor: 'end', dx: -8, dy: 4 });
    return port;
  }

  const fixedPorts = {
    '4': createLabeledPort(
      svg,
      '4',
      GX0 + fixedPortsLocal['4'].cx,
      GY0 + fixedPortsLocal['4'].cy,
      'V',
      'left',
    ),
    '2': createLabeledPort(
      svg,
      '2',
      GX0 + fixedPortsLocal['2'].cx,
      GY0 + fixedPortsLocal['2'].cy,
      'V',
      'left',
    ),
    '5': tightLeftLabeledPort('5'),
    '1': tightLeftLabeledPort('1'),
    '3': tightLeftLabeledPort('3'),
  };

  let silencer3: SilencerOption = 'silencer';
  let silencer5: SilencerOption = 'silencer';
  const silencer3El = createSilencerSymbol(
    GX0 + fixedPortsLocal['3'].cx,
    GY0 + fixedPortsLocal['3'].cy,
    1,
  );
  const silencer5El = createSilencerSymbol(
    GX0 + fixedPortsLocal['5'].cx,
    GY0 + fixedPortsLocal['5'].cy,
    1,
  );
  setSilencerState(fixedPorts['3'], silencer3El, silencer3);
  setSilencerState(fixedPorts['5'], silencer5El, silencer5);
  svg.append(silencer3El, silencer5El);

  let state: 0 | 1 = 1;

  function setShift(shift: number): void {
    gInner.setAttribute('transform', `translate(${GX0 + shift},${GY0})`);
  }
  function applyState(): void {
    setShift(state === 0 ? 0 : -W0);
  }
  applyState();

  const comp: Component = {
    id: uid(),
    type: VALVE_52_MONO_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports: { ...fixedPorts, '14': port14 },

    conductivityRule(): PortConnection[] {
      return state === 0
        ? [
            { a: '1', b: '4' },
            { a: '2', b: '3' },
          ]
        : [
            { a: '1', b: '2' },
            { a: '4', b: '5' },
          ];
    },

    // Spring-return: with only one pilot, position simply follows its current pressure level -
    // pressurized pushes it to state 0, vented lets the spring pull it straight back to state 1,
    // with no edge-detection or ambiguity handling needed (there's nothing to be ambiguous with).
    onPressureChange(ctx: ConductivityContext): void {
      state = ctx.isPressurized('14') ? 0 : 1;
      applyState();
    },

    snapshot(): Record<string, unknown> {
      return {
        state,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3,
        silencer5,
      };
    },
    restore(data: Record<string, unknown>): void {
      state = data.state as 0 | 1;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      silencer3 = (data.silencer3 as SilencerOption) ?? 'silencer';
      silencer5 = (data.silencer5 as SilencerOption) ?? 'silencer';
      setSilencerState(fixedPorts['3'], silencer3El, silencer3);
      setSilencerState(fixedPorts['5'], silencer5El, silencer5);
      applyState();
    },
    reset(): void {
      state = 1;
      applyState();
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  return comp;
}
