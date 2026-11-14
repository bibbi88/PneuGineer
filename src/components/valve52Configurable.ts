import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { listenWindow } from '../app/componentLifetime';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl } from './shared/svgHelpers';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { setSilencerState, type SilencerOption } from './shared/silencer';
import { drawValve52Body, VALVE_52_DEFAULT_GEOMETRY } from './valve52';
import { isSensorTriggeredAtRest } from './shared/sensorPositions';
import {
  ACTUATOR_LABELS,
  canBePilotOperated,
  createPilotSupplyPort,
  drawActuator,
  isActuator,
  isEndActuated,
  readPilotSupply,
  type Actuator,
  type PilotSupply,
} from './shared/valveActuators';

export const VALVE_52_CONFIGURABLE_TYPE = 'valve52Cfg';

export type Actuator52 = Actuator;
export const ACTUATOR_52_LABELS = ACTUATOR_LABELS;
export { canBePilotOperated };
export const LEFT_ACTUATORS: Actuator[] = ['air', 'solenoid', 'button', 'roller'];
export const RIGHT_ACTUATORS: Actuator[] = ['air', 'solenoid', 'button', 'roller', 'spring'];

/**
 * A 5/2 valve whose actuation is chosen per end - the inspector draws it with a dropdown at each
 * end (see ui/valveConfigurator.ts): an air pilot, a solenoid, a push button or a roller on the
 * left (14 side, shifting it to 1->4) and on the right (12 side, back to 1->2) - or a spring on
 * the right, which makes it monostable: it sits in 1->2 unless the left end is actuated.
 * Otherwise it's bistable, staying where it was last shifted, and starts from a chosen position.
 *
 * Pilot-operated (see shared/valveActuators.ts): an actuated end then only shifts the valve
 * while the pilot stage has air - from port 1 (internal) or port X (external) - and the symbol
 * shows the pilot stage as a filled triangle between actuator and body.
 */
export function createValve52Configurable(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = VALVE_52_DEFAULT_GEOMETRY;
  const svgW = geo.w0 * 2 + geo.extraW;
  const svgH = geo.h0 + geo.extraH;
  const shell = buildComponentShell(
    compLayer,
    VALVE_52_CONFIGURABLE_TYPE,
    x,
    y,
    svgW,
    svgH,
    '5/2 valve',
    { x: geo.gx0 - geo.w0, y: geo.gy0, w: geo.w0 * 2, h: geo.h0 },
  );
  const svg = shell.svg;
  svg.style.overflow = 'visible';

  const body = drawValve52Body(svg, geo, `arrow-v52c-${uid()}`);
  const { gInner, midX, fixedPorts, port12, port14, silencer3El, silencer5El } = body;
  shell.followFrame(gInner, geo.gx0 - geo.w0, geo.gy0);
  // The body's own air-pilot artwork on each end: [slide, pilot 12, pilot 14].
  const airRight = gInner.children[1] as SVGGElement;
  const airLeft = gInner.children[2] as SVGGElement;
  const leftGroup = createSvgEl('g');
  const rightGroup = createSvgEl('g');
  gInner.append(leftGroup, rightGroup);

  const BODY_W = geo.w0 * 2;
  const CY = geo.h0 / 2;
  /** The pilot ports' distance out from the end face (as drawValve52Body places them). */
  const PILOT_PORT_OUT = geo.pilotLinkGap + geo.pilotPortOffset;

  // External pilot supply: port X under the left end (the left cell, at rest).
  const supply = createPilotSupplyPort(
    svg,
    geo.gx0 - geo.w0 + 20,
    geo.gy0 + geo.h0,
    geo.gy0 + geo.h0 + geo.fixedPortLead,
  );

  let left: Actuator = 'air';
  let right: Actuator = 'air';
  let pilot: PilotSupply = 'none';
  let key14 = '';
  let key12 = '';
  let sensor14 = '';
  let sensor12 = '';
  /** Where a bistable valve starts each run: 0 = 1->4 (14 side), 1 = 1->2 (12 side). */
  let startPos: 0 | 1 = 1;
  let state: 0 | 1 = 1;
  let prev14 = false;
  let prev12 = false;
  let pressed14 = false;
  let pressed12 = false;
  let latched = false;
  let silencer3: SilencerOption = 'silencer';
  let silencer5: SilencerOption = 'silencer';

  const monostable = (): boolean => right === 'spring';
  const restState = (): 0 | 1 => (monostable() ? 1 : startPos);

  /** The body's own air-pilot artwork shows only for a plain air pilot; the port and its number
   * stay for a pilot-operated one, the rest drawn with the pilot stage. */
  function showBodyAir(group: SVGGElement, kind: Actuator): void {
    group.style.display = kind === 'air' ? '' : 'none';
    const direct = pilot === 'none';
    Array.from(group.children).forEach((child, i) => {
      // [triangle, wall line, pilot line, port, number]
      if (i < 3) (child as SVGElement).style.display = direct ? '' : 'none';
    });
  }

  function drawActuators(): void {
    showBodyAir(airLeft, left);
    showBodyAir(airRight, right);
    const at = (edgeX: number, dir: number): Parameters<typeof drawActuator>[5] => ({
      edgeX,
      cy: CY,
      portX: edgeX + dir * PILOT_PORT_OUT,
      bodyBottom: geo.h0,
    });
    const draws = (kind: Actuator): boolean => kind !== 'air' || pilot !== 'none';
    leftGroup.replaceChildren();
    rightGroup.replaceChildren();
    if (draws(left)) {
      drawActuator(leftGroup, 'left', left, left === 'roller' ? sensor14 : key14, pilot, at(0, -1));
    }
    if (draws(right)) {
      drawActuator(
        rightGroup,
        'right',
        right,
        right === 'roller' ? sensor12 : key12,
        pilot,
        at(BODY_W, 1),
      );
    }
    supply.group.style.display = pilot === 'external' ? '' : 'none';
  }

  function applyState(shown: 0 | 1 = state): void {
    gInner.setAttribute(
      'transform',
      `translate(${geo.gx0 + (shown === 0 ? 0 : -midX)},${geo.gy0})`,
    );
  }

  // While stopped, a monostable valve held over by its cylinder (a roller on a0, with the
  // cylinder in) is drawn shifted, as circuit diagrams draw the initial position - like the 3/2
  // limit valve. Only the drawing.
  function drawRestState(): void {
    if (appState.mode !== Modes.STOP) return;
    const held = monostable() && left === 'roller' && isSensorTriggeredAtRest(sensor14);
    applyState(held ? 0 : state);
  }
  appState.onChange(() => {
    drawActuators();
    drawRestState();
  }, shell.el);
  appState.onModeChange(drawRestState, shell.el);

  function actuated(ctx: ConductivityContext, side: 14 | 12): boolean {
    const end =
      side === 14
        ? { kind: left, pilotPort: '14', coil: key14, sensor: sensor14, pressed: pressed14 }
        : { kind: right, pilotPort: '12', coil: key12, sensor: sensor12, pressed: pressed12 };
    return isEndActuated(comp.id, end, pilot, ctx);
  }

  const comp: Component = {
    id: uid(),
    type: VALVE_52_CONFIGURABLE_TYPE,
    el: shell.el,
    x,
    y,
    svgW,
    svgH,
    gx: 0,
    gy: 0,
    ports: { ...fixedPorts, '12': port12, '14': port14, X: supply.port },

    // State 0: 1->4 and 2->3; state 1: 1->2 and 4->5 - the same cells as the other 5/2 valves.
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
      const a14 = actuated(ctx, 14);
      const a12 = actuated(ctx, 12);
      if (monostable()) {
        state = a14 ? 0 : 1;
      } else {
        // As the double-pilot valve: a newly actuated end moves it only while the other isn't
        // also held; once that one lets go, the one still held takes over.
        if (a12 && !prev12 && !a14) state = 1;
        else if (a14 && !prev14 && !a12) state = 0;
        else if (!a14 && prev14 && a12) state = 1;
        else if (!a12 && prev12 && a14) state = 0;
      }
      prev14 = a14;
      prev12 = a12;
      applyState();
    },

    snapshot(): Record<string, unknown> {
      return {
        left,
        right,
        pilotSupply: pilot,
        key14,
        key12,
        sensor14,
        sensor12,
        startPos,
        state,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3,
        silencer5,
      };
    },
    restore(data: Record<string, unknown>): void {
      const before = `${left}|${right}|${startPos}`;
      left = isActuator(data.left, LEFT_ACTUATORS) ? data.left : 'air';
      right = isActuator(data.right, RIGHT_ACTUATORS) ? data.right : 'air';
      pilot = readPilotSupply(data);
      key14 = typeof data.key14 === 'string' ? data.key14 : '';
      key12 = typeof data.key12 === 'string' ? data.key12 : '';
      sensor14 = typeof data.sensor14 === 'string' ? data.sensor14 : '';
      sensor12 = typeof data.sensor12 === 'string' ? data.sensor12 : '';
      startPos = data.startPos === 0 ? 0 : 1;
      // Reconfigured while stopped: it stands where a run will now start from.
      const changed = before !== `${left}|${right}|${startPos}`;
      state =
        changed && appState.mode === Modes.STOP
          ? restState()
          : data.state === 0 || data.state === 1
            ? data.state
            : restState();
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      silencer3 = (data.silencer3 as SilencerOption) ?? 'silencer';
      silencer5 = (data.silencer5 as SilencerOption) ?? 'silencer';
      setSilencerState(fixedPorts['3'], silencer3El, silencer3);
      setSilencerState(fixedPorts['5'], silencer5El, silencer5);
      drawActuators();
      applyState();
      drawRestState();
    },
    reset(): void {
      state = restState();
      prev14 = false;
      prev12 = false;
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
  // is down, or latched with Ctrl (like the 3/2 push button valve).
  function setPressed(side: 14 | 12, on: boolean): void {
    if (side === 14) pressed14 = on;
    else pressed12 = on;
  }
  function release(): void {
    if (latched) return;
    pressed14 = false;
    pressed12 = false;
  }
  shell.svg.addEventListener('mousedown', (e) => {
    if (appState.mode === Modes.STOP) return;
    const rect = shell.svg.getBoundingClientRect();
    const side: 14 | 12 = e.clientX - rect.left < rect.width / 2 ? 14 : 12;
    if ((side === 14 ? left : right) !== 'button') return;
    e.stopPropagation();
    if (latched) {
      latched = false;
      setPressed(side, false);
      return;
    }
    latched = e.ctrlKey;
    setPressed(side, true);
  });
  listenWindow(shell.el, 'mouseup', release);
  listenWindow(shell.el, 'keyup', (e) => {
    if (e.key === 'Control' && latched) {
      latched = false;
      pressed14 = false;
      pressed12 = false;
    }
  });

  drawActuators();
  applyState();
  return comp;
}

/** The configurable valve equivalent of one of the fixed 5/2 valve types - what the inspector's
 * valve configurator starts from when one of those is reconfigured. */
export function configFromLegacy(
  type: string,
  snap: Record<string, unknown>,
): Record<string, unknown> | null {
  const common = {
    showName: snap.showName,
    customName: snap.customName,
    silencer3: snap.silencer3,
    silencer5: snap.silencer5,
  };
  switch (type) {
    case 'valve52':
      return { ...common, left: 'air', right: 'air', startPos: 1 };
    case 'valve52Mono':
      return { ...common, left: 'air', right: 'spring' };
    case 'valve52Solenoid':
      return { ...common, left: 'solenoid', right: 'spring', key14: snap.key };
    case 'valve52SolenoidDouble':
      return {
        ...common,
        left: 'solenoid',
        right: 'solenoid',
        key14: snap.key14,
        key12: snap.key12,
        startPos: 1,
      };
    case VALVE_52_CONFIGURABLE_TYPE:
      return { ...snap };
    default:
      return null;
  }
}
