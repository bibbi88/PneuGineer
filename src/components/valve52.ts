import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import {
  buildComponentShell,
  createSvgEl,
  createPort,
  createLabeledPort,
  addDoubleArrowMarker,
} from './shared/svgHelpers';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';

export const VALVE_52_TYPE = 'valve52';

// ===== Geometry, ported 1:1 from the original app's two-cell sliding 5/2 symbol =====
const W0 = 80; // single cell width
const H0 = 60; // single cell height
const BODY_W = W0 * 2;
const BODY_H = H0;
const GX0 = 115; // static offset of the housing within the svg canvas (room for pilot ports)
const GY0 = 24; // vertical offset so ports 4/2 (above) and 5/1/3 (below) fit inside the canvas
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
const PORT12_LOCAL_X = W0 * 2 + 15 + PILOT_PORT_OFFSET;

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

export function createValve52(compLayer: HTMLElement, x: number, y: number): Component {
  const shell = buildComponentShell(compLayer, VALVE_52_TYPE, x, y, SVG_W, SVG_H, '');
  const svg = shell.svg;
  svg.style.overflow = 'visible';

  const arrowId = `arrow-v52-${uid()}`;
  addDoubleArrowMarker(svg, arrowId);

  // gInner carries the fixed housing offset (GX0) plus the dynamic slide shift in one
  // transform, since the original app nested a static gRoot offset around a sliding gInner.
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

  gSlide.append(cell0, cell1);

  function addTriangleAndWallLine(parent: SVGElement, side: 'left' | 'right'): void {
    const tipX = side === 'left' ? -TRI_GAP : BODY_W + TRI_GAP;
    const dir = side === 'left' ? -1 : 1;
    const points = [
      [tipX, PILOT_CY],
      [tipX + dir * TRI_W, PILOT_CY - TRI_H / 2],
      [tipX + dir * TRI_W, PILOT_CY + TRI_H / 2],
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
        x2: side === 'left' ? 0 : BODY_W,
        y2: PILOT_CY,
        stroke: '#111',
        'stroke-width': STROKE,
      }),
    );
  }

  const gP14 = createSvgEl('g');
  const gP12 = createSvgEl('g');
  addTriangleAndWallLine(gP14, 'left');
  addTriangleAndWallLine(gP12, 'right');

  gP14.appendChild(
    createSvgEl('line', {
      x1: PORT14_LOCAL_X + 6,
      y1: PILOT_CY,
      x2: -TRI_GAP - TRI_W,
      y2: PILOT_CY,
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );
  gP12.appendChild(
    createSvgEl('line', {
      x1: BODY_W + TRI_GAP + TRI_W,
      y1: PILOT_CY,
      x2: PORT12_LOCAL_X - 6,
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

  const port12 = createPort(svg, '12', PORT12_LOCAL_X, PILOT_CY, 'H', {
    isPilot: true,
    pilotDir: 1,
  });
  port12.el.setAttribute('r', '6');
  const label12 = createSvgEl('text', {
    x: PORT12_LOCAL_X,
    y: PILOT_CY - 10,
    'text-anchor': 'middle',
    'font-size': FONT,
  });
  label12.textContent = '12';
  gP12.append(port12.el, label12);

  gInner.append(gSlide, gP12, gP14);
  svg.appendChild(gInner);

  // ===== Fixed ports (do not slide), offset by GX0 into the housing's coordinate space =====
  const fixedPortsLocal = {
    '4': { cx: 10, cy: -10 },
    '2': { cx: W0 - 10, cy: -10 },
    '5': { cx: 10, cy: H0 + 10 },
    '1': { cx: W0 / 2, cy: H0 + 10 },
    '3': { cx: W0 - 10, cy: H0 + 10 },
  } as const;

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
    '5': createLabeledPort(
      svg,
      '5',
      GX0 + fixedPortsLocal['5'].cx,
      GY0 + fixedPortsLocal['5'].cy,
      'V',
      'left',
    ),
    '1': createLabeledPort(
      svg,
      '1',
      GX0 + fixedPortsLocal['1'].cx,
      GY0 + fixedPortsLocal['1'].cy,
      'V',
      'left',
    ),
    '3': createLabeledPort(
      svg,
      '3',
      GX0 + fixedPortsLocal['3'].cx,
      GY0 + fixedPortsLocal['3'].cy,
      'V',
      'left',
    ),
  };

  let state: 0 | 1 = 1;
  let pilot12Prev = false;
  let pilot14Prev = false;

  function setShift(shift: number): void {
    gInner.setAttribute('transform', `translate(${GX0 + shift},${GY0})`);
  }
  function applyState(): void {
    setShift(state === 0 ? 0 : -W0);
  }
  applyState();

  const comp: Component = {
    id: uid(),
    type: VALVE_52_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports: { ...fixedPorts, '12': port12, '14': port14 },

    // State 0 shows cell0 under the fixed ports: its diagonal arrow runs port4-column to
    // port1-column (1<->4) and its vertical arrow runs port2-column to port3-column (2<->3).
    // State 1 shows cell1: diagonal runs 1<->2, vertical runs 4<->5. This must match the
    // drawn artwork exactly, or the diagram shows one routing while simulating another.
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

    onPressureChange(ctx: ConductivityContext): void {
      const pilot12 = ctx.isPressurized('12');
      const pilot14 = ctx.isPressurized('14');
      const rising12 = pilot12 && !pilot12Prev;
      const rising14 = pilot14 && !pilot14Prev;
      // If both pilots newly pressurize in the same tick, the command is ambiguous (a real
      // double-pilot valve would be pushed from both ends at once) - hold the current state
      // rather than letting whichever branch happened to run last silently win.
      if (rising12 && !rising14) state = 1;
      else if (rising14 && !rising12) state = 0;
      pilot12Prev = pilot12;
      pilot14Prev = pilot14;
      applyState();
    },

    snapshot(): Record<string, unknown> {
      return { state };
    },
    restore(data: Record<string, unknown>): void {
      state = data.state as 0 | 1;
      applyState();
    },
    reset(): void {
      state = 0;
      pilot12Prev = false;
      pilot14Prev = false;
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

  function toggle(): void {
    if (appState.mode === Modes.STOP) return;
    state = state === 0 ? 1 : 0;
    applyState();
  }
  gSlide.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  return comp;
}
