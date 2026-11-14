import type { Component, ConductivityContext, PortConnection, PortDef } from '../core/types';
import { listenWindow } from '../app/componentLifetime';
import { uid } from '../core/ids';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { setSilencerState, type SilencerOption } from './shared/silencer';
import { addSpringZigzag, SPRING_DEFAULT_GEOMETRY } from './shared/spring';
import {
  addArrow,
  addDeadEndStub,
  drawValve53MonoBody,
  VALVE_53_MONO_DEFAULT_GEOMETRY,
} from './valve53Mono';
import { isSensorTriggeredAtRest } from './shared/sensorPositions';
import {
  createPilotSupplyPort,
  drawActuator,
  isActuator,
  isEndActuated,
  readPilotSupply,
  type Actuator,
  type PilotSupply,
} from './shared/valveActuators';

export const VALVE_53_CONFIGURABLE_TYPE = 'valve53Cfg';

/** Both ends of a 5/3 valve carry a centring spring as well, so neither end is a spring alone. */
export const END_ACTUATORS_53: Actuator[] = ['air', 'solenoid', 'button', 'roller'];

/** The centre position, as ISO 1219 / the usual catalogue variants: everything blocked, both
 * outlets to exhaust (supply blocked), or both outlets pressurized (exhausts blocked). */
export type Centre53 = 'closed' | 'exhaust' | 'pressure';

export const CENTRE_53_LABELS: Record<Centre53, string> = {
  closed: 'Closed',
  exhaust: 'Exhausted',
  pressure: 'Pressurized',
};

type State53 = 'L' | 'C' | 'R';

function isCentre(v: unknown): v is Centre53 {
  return v === 'closed' || v === 'exhaust' || v === 'pressure';
}

/**
 * A spring-centred 5/3 valve whose actuation is chosen per end - air pilot, solenoid, push
 * button or roller, each against a centring spring on the same end face - and whose centre
 * position is chosen too (see Centre53). It sits in the centre while neither end (or both) is
 * actuated; the left end (14) shifts it to 1->4, the right (12) to 1->2. Pilot-operated as the
 * configurable 5/2 valve (shared/valveActuators.ts).
 */
export function createValve53Configurable(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = VALVE_53_MONO_DEFAULT_GEOMETRY;
  const svgW = geo.w0 * 3 + geo.extraW;
  const svgH = geo.h0 + geo.extraH;
  const shell = buildComponentShell(
    compLayer,
    VALVE_53_CONFIGURABLE_TYPE,
    x,
    y,
    svgW,
    svgH,
    '5/3 valve',
    { x: geo.gx0 - geo.w0, y: geo.gy0, w: geo.w0 * 3, h: geo.h0 },
  );
  const svg = shell.svg;
  svg.style.overflow = 'visible';

  const arrowId = `arrow-v53c-${uid()}`;
  const body = drawValve53MonoBody(svg, geo, arrowId);
  const { gInner, cellW, fixedPorts, leftGroup, rightGroup, silencer3El, silencer5El } = body;
  shell.followFrame(gInner, geo.gx0 - geo.w0, geo.gy0);
  const cellC = (gInner.children[0] as SVGGElement).children[1] as SVGGElement;

  const W0 = geo.w0;
  const H0 = geo.h0;
  const CY = H0 / 2;
  const SPRING_Y = CY - geo.actuatorSplitY;
  const ACT_Y = CY + geo.actuatorSplitY;
  /** Pilot ports' distance out from the end face (as the 5/3 pilot valve places them). */
  const PILOT_PORT_OUT = 40;

  /** One end: its centring spring, its actuator, and its air pilot port (shown for an air
   * pilot only). */
  function makeEnd(
    group: SVGGElement,
    side: 'left' | 'right',
    key: '14' | '12',
  ): { act: SVGGElement; portGroup: SVGGElement; port: PortDef; edge: number } {
    const dir = side === 'left' ? -1 : 1;
    const edge = side === 'left' ? 0 : W0 * 3;
    const spring = createSvgEl('g');
    addSpringZigzag(
      spring,
      edge,
      edge + dir * SPRING_DEFAULT_GEOMETRY.springSpan,
      SPRING_Y,
      2,
      SPRING_DEFAULT_GEOMETRY,
    );
    const act = createSvgEl('g');
    const portGroup = createSvgEl('g');
    group.append(spring, act, portGroup);
    const portX = edge + dir * PILOT_PORT_OUT;
    const port = createPort(portGroup, key, portX, ACT_Y, 'H', {
      isPilot: true,
      pilotDir: dir as 1 | -1,
    });
    const label = createSvgEl('text', {
      x: portX,
      y: ACT_Y + 18,
      'text-anchor': 'middle',
      'font-size': geo.font,
    });
    label.textContent = key;
    portGroup.appendChild(label);
    return { act, portGroup, port, edge };
  }
  leftGroup.replaceChildren();
  rightGroup.replaceChildren();
  const endL = makeEnd(leftGroup, 'left', '14');
  const endR = makeEnd(rightGroup, 'right', '12');

  const supply = createPilotSupplyPort(
    svg,
    geo.gx0 - geo.w0 + 20,
    geo.gy0 + H0,
    geo.gy0 + H0 + geo.fixedPortLead,
  );

  let left: Actuator = 'air';
  let right: Actuator = 'air';
  let centre: Centre53 = 'closed';
  let pilot: PilotSupply = 'none';
  let key14 = '';
  let key12 = '';
  let sensor14 = '';
  let sensor12 = '';
  let state: State53 = 'C';
  let pressed14 = false;
  let pressed12 = false;
  let latched = false;
  let silencer3: SilencerOption = 'silencer';
  let silencer5: SilencerOption = 'silencer';

  /** The centre cell's paths for the chosen centre function. */
  function drawCentre(): void {
    const L = geo.fixedPortInset;
    const R = W0 - geo.fixedPortInset;
    const M = W0 / 2;
    cellC.replaceChildren(
      createSvgEl('rect', {
        x: 0,
        y: 0,
        width: W0,
        height: H0,
        fill: '#fff',
        stroke: '#111',
        'stroke-width': geo.stroke,
      }),
    );
    if (centre === 'closed') {
      addDeadEndStub(cellC, L, true, geo);
      addDeadEndStub(cellC, R, true, geo);
      addDeadEndStub(cellC, L, false, geo);
      addDeadEndStub(cellC, M, false, geo);
      addDeadEndStub(cellC, R, false, geo);
    } else if (centre === 'exhaust') {
      addArrow(cellC, L, 0, L, H0, geo.stroke, arrowId);
      addArrow(cellC, R, 0, R, H0, geo.stroke, arrowId);
      addDeadEndStub(cellC, M, false, geo);
    } else {
      addArrow(cellC, M, H0, L, 0, geo.stroke, arrowId);
      addArrow(cellC, M, H0, R, 0, geo.stroke, arrowId);
      addDeadEndStub(cellC, L, false, geo);
      addDeadEndStub(cellC, R, false, geo);
    }
  }

  function drawEnds(): void {
    for (const [end, kind, label, side] of [
      [endL, left, left === 'roller' ? sensor14 : key14, 'left'],
      [endR, right, right === 'roller' ? sensor12 : key12, 'right'],
    ] as const) {
      const dir = side === 'left' ? -1 : 1;
      drawActuator(end.act, side, kind, label, pilot, {
        edgeX: end.edge,
        cy: ACT_Y,
        portX: end.edge + dir * PILOT_PORT_OUT,
        bodyBottom: H0,
        labelBelow: true,
      });
      end.portGroup.style.display = kind === 'air' ? '' : 'none';
    }
    supply.group.style.display = pilot === 'external' ? '' : 'none';
  }

  function applyState(shown: State53 = state): void {
    const shift = shown === 'L' ? 0 : shown === 'C' ? -cellW : -cellW * 2;
    gInner.setAttribute('transform', `translate(${geo.gx0 + shift},${geo.gy0})`);
  }

  // While stopped, a roller its cylinder holds down at rest is drawn shifting the valve, as the
  // initial position is drawn (see the 3/2 limit valve). Only the drawing.
  function drawRestState(): void {
    if (appState.mode !== Modes.STOP) return;
    const l = left === 'roller' && isSensorTriggeredAtRest(sensor14);
    const r = right === 'roller' && isSensorTriggeredAtRest(sensor12);
    applyState(l && !r ? 'L' : r && !l ? 'R' : state);
  }
  appState.onChange(() => {
    drawEnds();
    drawRestState();
  }, shell.el);
  appState.onModeChange(drawRestState, shell.el);

  const comp: Component = {
    id: uid(),
    type: VALVE_53_CONFIGURABLE_TYPE,
    el: shell.el,
    x,
    y,
    svgW,
    svgH,
    gx: 0,
    gy: 0,
    ports: { ...fixedPorts, '14': endL.port, '12': endR.port, X: supply.port },

    conductivityRule(): PortConnection[] {
      if (state === 'L') {
        return [
          { a: '1', b: '4' },
          { a: '2', b: '3' },
        ];
      }
      if (state === 'R') {
        return [
          { a: '1', b: '2' },
          { a: '4', b: '5' },
        ];
      }
      if (centre === 'exhaust') {
        return [
          { a: '4', b: '5' },
          { a: '2', b: '3' },
        ];
      }
      if (centre === 'pressure') {
        return [
          { a: '1', b: '4' },
          { a: '1', b: '2' },
        ];
      }
      return [];
    },

    // Spring-centred: it follows whichever single end is actuated; neither or both, it centres.
    onPressureChange(ctx: ConductivityContext): void {
      const a14 = isEndActuated(
        comp.id,
        { kind: left, pilotPort: '14', coil: key14, sensor: sensor14, pressed: pressed14 },
        pilot,
        ctx,
      );
      const a12 = isEndActuated(
        comp.id,
        { kind: right, pilotPort: '12', coil: key12, sensor: sensor12, pressed: pressed12 },
        pilot,
        ctx,
      );
      state = a14 && !a12 ? 'L' : a12 && !a14 ? 'R' : 'C';
      applyState();
    },

    snapshot(): Record<string, unknown> {
      return {
        left,
        right,
        centre,
        pilotSupply: pilot,
        key14,
        key12,
        sensor14,
        sensor12,
        state,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3,
        silencer5,
      };
    },
    restore(data: Record<string, unknown>): void {
      left = isActuator(data.left, END_ACTUATORS_53) ? data.left : 'air';
      right = isActuator(data.right, END_ACTUATORS_53) ? data.right : 'air';
      centre = isCentre(data.centre) ? data.centre : 'closed';
      pilot = readPilotSupply(data);
      key14 = typeof data.key14 === 'string' ? data.key14 : '';
      key12 = typeof data.key12 === 'string' ? data.key12 : '';
      sensor14 = typeof data.sensor14 === 'string' ? data.sensor14 : '';
      sensor12 = typeof data.sensor12 === 'string' ? data.sensor12 : '';
      state =
        appState.mode !== Modes.STOP && (data.state === 'L' || data.state === 'R')
          ? data.state
          : 'C';
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      silencer3 = (data.silencer3 as SilencerOption) ?? 'silencer';
      silencer5 = (data.silencer5 as SilencerOption) ?? 'silencer';
      setSilencerState(fixedPorts['3'], silencer3El, silencer3);
      setSilencerState(fixedPorts['5'], silencer5El, silencer5);
      drawCentre();
      drawEnds();
      applyState();
      drawRestState();
    },
    reset(): void {
      state = 'C';
      pressed14 = false;
      pressed12 = false;
      latched = false;
      applyState();
      drawRestState();
    },

    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  // A push button on either end is pressed with the mouse during a run - held while the button
  // is down, or latched with Ctrl.
  shell.svg.addEventListener('mousedown', (e) => {
    if (appState.mode === Modes.STOP) return;
    const rect = shell.svg.getBoundingClientRect();
    const side: 14 | 12 = e.clientX - rect.left < rect.width / 2 ? 14 : 12;
    if ((side === 14 ? left : right) !== 'button') return;
    e.stopPropagation();
    if (latched) {
      latched = false;
      pressed14 = false;
      pressed12 = false;
      return;
    }
    latched = e.ctrlKey;
    if (side === 14) pressed14 = true;
    else pressed12 = true;
  });
  listenWindow(shell.el, 'mouseup', () => {
    if (latched) return;
    pressed14 = false;
    pressed12 = false;
  });
  listenWindow(shell.el, 'keyup', (e) => {
    if (e.key === 'Control' && latched) {
      latched = false;
      pressed14 = false;
      pressed12 = false;
    }
  });

  drawCentre();
  drawEnds();
  applyState();
  return comp;
}
