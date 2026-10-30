import type { Component, ConductivityContext, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl } from './shared/svgHelpers';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { setSilencerState, type SilencerOption } from './shared/silencer';
import { addSpringZigzag, SPRING_DEFAULT_GEOMETRY } from './shared/spring';
import { drawValve52Body, VALVE_52_DEFAULT_GEOMETRY } from './valve52';
import { drawSolenoid, markDuplicateLabel } from './solenoidValves';
import { getSignal } from '../sim/signals';
import { flowPressureAt } from '../sim/flowNetwork';
import { portKey } from '../sim/pressure';
import { PILOT_MIN_BAR } from '../sim/engine';
import { isSensorTriggeredAtRest } from './shared/sensorPositions';

export const VALVE_52_CONFIGURABLE_TYPE = 'valve52Cfg';

/** What shifts a configurable 5/2 valve from one end: an air pilot (port 14/12), a solenoid
 * (a coil name, Y1...), a manual push button, a roller (a cylinder sensor, a0...) - or, on the
 * right, a return spring. */
export type Actuator52 = 'air' | 'solenoid' | 'button' | 'roller' | 'spring';

export const ACTUATOR_52_LABELS: Record<Actuator52, string> = {
  air: 'Air pilot',
  solenoid: 'Solenoid',
  button: 'Push button',
  roller: 'Roller',
  spring: 'Spring',
};
export const LEFT_ACTUATORS: Actuator52[] = ['air', 'solenoid', 'button', 'roller'];
export const RIGHT_ACTUATORS: Actuator52[] = ['air', 'solenoid', 'button', 'roller', 'spring'];

/** Actuators that can work through an internal pilot (servo / pilot-operated): the solenoid,
 * button or roller only opens a small pilot valve, and air taken from port 1 shifts the spool. */
export function canBePilotOperated(a: Actuator52): boolean {
  return a === 'solenoid' || a === 'button' || a === 'roller';
}

function isActuator(v: unknown, allowed: Actuator52[]): v is Actuator52 {
  return typeof v === 'string' && (allowed as string[]).includes(v);
}

const STROKE = 2;

/**
 * A 5/2 valve whose actuation is chosen per end - the inspector draws it with a dropdown at each
 * end (see ui/valveConfigurator.ts): an air pilot, a solenoid, a push button or a roller on the
 * left (14 side, shifting it to 1->4) and on the right (12 side, back to 1->2) - or a spring on
 * the right, which makes it monostable: it sits in 1->2 unless the left end is actuated.
 * Otherwise it's bistable, staying where it was last shifted, and starts from a chosen position.
 *
 * Pilot-operated: a solenoid, button or roller then only shifts the valve while port 1 has
 * enough pressure to drive the spool (PILOT_MIN_BAR in flow mode; pressurized in logic mode),
 * and the symbol shows the internal pilot as a filled triangle between actuator and body.
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

  let left: Actuator52 = 'air';
  let right: Actuator52 = 'air';
  let pilotOperated = false;
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

  /** Draws one end's actuator into `group`, its body-side edge at `edgeX`. Returns the label
   * text element, if the actuator has one (a coil name or a sensor). */
  function drawActuator(
    group: SVGGElement,
    side: 'left' | 'right',
    kind: Actuator52,
    label: string,
  ): void {
    group.replaceChildren();
    if (kind === 'air') return;
    const dir = side === 'left' ? -1 : 1;
    let edge = side === 'left' ? 0 : BODY_W;
    const line = (x1: number, y1: number, x2: number, y2: number, w = STROKE): SVGElement =>
      createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': w });

    if (kind === 'spring') {
      addSpringZigzag(
        group,
        edge,
        edge + dir * SPRING_DEFAULT_GEOMETRY.springSpan,
        CY,
        STROKE,
        SPRING_DEFAULT_GEOMETRY,
      );
      return;
    }

    if (pilotOperated) {
      // The internal pilot: a filled triangle against the end face, in a small box, with the
      // actuator itself further out (ISO 1219-1 pilot-operated actuation).
      const boxW = 16;
      const x0 = Math.min(edge, edge + dir * boxW);
      group.append(
        createSvgEl('rect', {
          x: x0,
          y: CY - 9,
          width: boxW,
          height: 18,
          fill: '#fff',
          stroke: '#111',
          'stroke-width': STROKE,
        }),
        createSvgEl('polygon', {
          points: [
            [edge + dir * 3, CY],
            [edge + dir * 12, CY - 5],
            [edge + dir * 12, CY + 5],
          ]
            .map((p) => p.join(','))
            .join(' '),
          fill: '#111',
        }),
      );
      edge += dir * boxW;
    }

    if (kind === 'solenoid') {
      const sub = createSvgEl('g');
      group.appendChild(sub);
      const text = drawSolenoid(sub, side, edge, CY);
      text.textContent = label;
      markDuplicateLabel(text, label);
      return;
    }

    if (kind === 'button') {
      // A plunger with a mushroom head.
      const out = edge + dir * 16;
      group.append(
        line(edge, CY, out, CY),
        line(out, CY - 10, out, CY + 10, 2.5),
        createSvgEl('path', {
          d: `M ${out} ${CY - 10} q ${dir * 7} 10 0 20`,
          fill: 'none',
          stroke: '#111',
          'stroke-width': STROKE,
        }),
      );
      return;
    }

    // Roller lever: two arms out to a roller, the sensor's name above it.
    const rx = edge + dir * 26;
    group.append(
      line(edge, CY - 6, rx, CY - 6),
      line(edge, CY + 6, rx, CY + 6),
      createSvgEl('circle', {
        cx: rx + dir * 4,
        cy: CY,
        r: 10,
        fill: '#fff',
        stroke: '#111',
        'stroke-width': STROKE,
      }),
      createSvgEl('circle', {
        cx: rx + dir * 4,
        cy: CY,
        r: 4,
        fill: '#fff',
        stroke: '#111',
        'stroke-width': STROKE,
      }),
    );
    const text = createSvgEl('text', {
      x: rx + dir * 4,
      y: CY - 15,
      'text-anchor': 'middle',
      'font-size': 11,
    });
    text.textContent = label;
    group.appendChild(text);
  }

  function drawActuators(): void {
    airLeft.style.display = left === 'air' ? '' : 'none';
    airRight.style.display = right === 'air' ? '' : 'none';
    drawActuator(leftGroup, 'left', left, left === 'roller' ? sensor14 : key14);
    drawActuator(rightGroup, 'right', right, right === 'roller' ? sensor12 : key12);
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
  });
  appState.onModeChange(drawRestState);

  /** Whether port 1 has the pressure an internal pilot needs. */
  function pilotSupply(ctx: ConductivityContext): boolean {
    if (appState.simulationMode === 'flow') {
      return (flowPressureAt(portKey(comp.id, '1')) ?? 0) >= PILOT_MIN_BAR;
    }
    return ctx.isPressurized('1');
  }

  function actuated(ctx: ConductivityContext, side: 14 | 12): boolean {
    const kind = side === 14 ? left : right;
    let on = false;
    if (kind === 'air') on = ctx.isPressurized(side === 14 ? '14' : '12');
    else if (kind === 'solenoid') {
      const key = side === 14 ? key14 : key12;
      on = key ? getSignal(key) : false;
    } else if (kind === 'button') on = side === 14 ? pressed14 : pressed12;
    else if (kind === 'roller') {
      const sensor = side === 14 ? sensor14 : sensor12;
      on = sensor ? getSignal(sensor) : false;
    }
    if (on && pilotOperated && canBePilotOperated(kind)) on = pilotSupply(ctx);
    return on;
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
    ports: { ...fixedPorts, '12': port12, '14': port14 },

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
        pilotOperated,
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
      pilotOperated = Boolean(data.pilotOperated);
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
  window.addEventListener('mouseup', release);
  window.addEventListener('keyup', (e) => {
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
