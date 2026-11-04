import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { buildComponentShell, createSvgEl } from './shared/svgHelpers';
import {
  buildSlidingValve32Body,
  SLIDING_VALVE_W,
  SLIDING_VALVE_H,
  SLIDING_VALVE_OFFSET_X,
  SLIDING_VALVE_OFFSET_Y,
} from './shared/slidingValve32';
import { getSignal, getSignalMotion, hasSignal } from '../sim/signals';
import { appState } from '../app/AppState';
import {
  isSensorKeyBoundElsewhere,
  isSensorTriggeredAtRest,
  sensorRangeOf,
} from './shared/sensorPositions';
import { Modes } from '../app/modes';
import { addSpringZigzag, SPRING_DEFAULT_GEOMETRY } from './shared/spring';

export const LIMIT_VALVE_32_TYPE = 'limitValve32';

/** The limit valve's roller: an ordinary roller lever, actuated whenever its sensor is, or a
 * one-way roller lever (idle return). A cam coming onto that one the way it's set for presses
 * it, and it stays pressed while the cam is on it - stopped there, or moving back off; a cam
 * coming onto it the other way folds it away until the cam has gone. Mounted just short of the
 * end of the stroke, the cam passes over and leaves it: a short signal. */
export type RollerKind = 'roller' | 'oneWayExtend' | 'oneWayRetract';

export const ROLLER_KIND_LABELS: Record<RollerKind, string> = {
  roller: 'Roller lever',
  oneWayExtend: 'One-way, trips on extend',
  oneWayRetract: 'One-way, trips on retract',
};

export function isRollerKind(v: unknown): v is RollerKind {
  return v === 'roller' || v === 'oneWayExtend' || v === 'oneWayRetract';
}

// Extra right-side room for the spring symbol, beyond the offset already reserved on the left.
// (+50/+34 rather than the "natural" +48/+30: chosen so ports 1/2/3 land exactly on the 10px
// grid relative to this canvas's own center - see src/core/grid.ts.)
const SVG_W = SLIDING_VALVE_OFFSET_X + SLIDING_VALVE_W + 50;
const SVG_H = SLIDING_VALVE_OFFSET_Y + SLIDING_VALVE_H + 34;

export interface LimitValve32Geometry {
  /** x of the roller-lever group, relative to the mover's own origin. */
  rollerX: number;
  rollerArmStartX: number;
  rollerArmReach: number;
  rollerArmHalfY: number;
  rollerOuterR: number;
  rollerInnerR: number;
  rollerCenterX: number;
  labelYOffset: number;
  /** Return spring - see SPRING_DEFAULT_GEOMETRY in shared/spring.ts, which every
   * valve's spring is drawn from so the symbol set shares one design. */
  springSpan: number;
  springSegLen: number;
  springZigW: number;
  springZigH: number;
}

export const LIMIT_VALVE_32_DEFAULT_GEOMETRY: LimitValve32Geometry = {
  rollerX: -34,
  rollerArmStartX: -6,
  rollerArmReach: 35,
  rollerArmHalfY: 7,
  rollerOuterR: 13,
  rollerInnerR: 6,
  rollerCenterX: 4,
  labelYOffset: -18,
  springSpan: SPRING_DEFAULT_GEOMETRY.springSpan,
  springSegLen: SPRING_DEFAULT_GEOMETRY.springSegLen,
  springZigW: SPRING_DEFAULT_GEOMETRY.springZigW,
  springZigH: SPRING_DEFAULT_GEOMETRY.springZigH,
};

/** Draws the roller lever + arms + spring into the mover, matching the original app's
 * roller-lever limit-switch artwork - or, for a one-way roller, the ISO idle-return lever: the
 * roller on a hinged lever angled up (trips on extend) or down (trips on retract). Coordinates
 * are local to the mover, not the canvas. `cam` is the cylinder's trip cam pressing the roller,
 * the sign that the valve is held actuated - hidden until the caller shows it. */
export function drawLimitValve32Actuator(
  mover: SVGGElement,
  geo: LimitValve32Geometry,
  kind: RollerKind = 'roller',
): { sensorLabel: SVGTextElement; cam: SVGElement } {
  const rollerGroup = createSvgEl('g', {
    transform: `translate(${geo.rollerX}, ${SLIDING_VALVE_H / 2})`,
  });
  const stroke = { fill: 'none', stroke: '#111', 'stroke-width': 2 };
  const oneWay = kind !== 'roller';
  // The two arms from the body out to the roller - to the lever's hinge on a one-way roller.
  const armStart = oneWay ? ONE_WAY_HINGE_X : geo.rollerArmStartX;
  for (const y of [-geo.rollerArmHalfY, geo.rollerArmHalfY]) {
    rollerGroup.appendChild(
      createSvgEl('path', { d: `M ${armStart} ${y} L ${geo.rollerArmReach} ${y}`, ...stroke }),
    );
  }

  let cx = geo.rollerCenterX;
  let cy = 0;
  let outerR = geo.rollerOuterR;
  let innerR = geo.rollerInnerR;
  let labelY = geo.labelYOffset;
  if (oneWay) {
    const up = kind === 'oneWayExtend' ? -1 : 1;
    cx = ONE_WAY_ROLLER_X;
    cy = up * ONE_WAY_ROLLER_RISE;
    outerR = ONE_WAY_ROLLER_R;
    innerR = 4;
    // Hinge: a cross-bar closing the arms, the pivot on it, and the lever out to the roller.
    rollerGroup.append(
      createSvgEl('path', {
        d: `M ${ONE_WAY_HINGE_X} ${-geo.rollerArmHalfY} L ${ONE_WAY_HINGE_X} ${geo.rollerArmHalfY}`,
        ...stroke,
      }),
      createSvgEl('path', { d: `M ${ONE_WAY_HINGE_X} 0 L ${cx} ${cy}`, ...stroke }),
      createSvgEl('circle', { cx: ONE_WAY_HINGE_X, cy: 0, r: 2.5, fill: '#111' }),
    );
    labelY = up < 0 ? cy - outerR - 4 : geo.labelYOffset;
  }
  rollerGroup.append(
    createSvgEl('circle', { cx, cy, r: outerR, ...stroke, fill: '#fff' }),
    createSvgEl('circle', { cx, cy, r: innerR, ...stroke, fill: '#fff' }),
  );
  const sensorLabel = createSvgEl('text', {
    x: cx,
    y: labelY,
    'text-anchor': 'middle',
    'font-size': 11,
  });
  rollerGroup.appendChild(sensorLabel);

  // A solid wedge pointing at the roller from outside, its tip touching it.
  const camTip = cx - outerR - 1;
  const cam = createSvgEl('path', {
    d: `M ${camTip} ${cy} L ${camTip - 14} ${cy - 8} L ${camTip - 14} ${cy + 8} Z`,
    fill: '#111',
    class: 'limitValveCam',
  });
  cam.style.display = 'none';
  rollerGroup.appendChild(cam);

  const spring = createSvgEl('g', {
    transform: `translate(${SLIDING_VALVE_W}, ${SLIDING_VALVE_H / 2})`,
  });
  addSpringZigzag(spring, 0, geo.springSpan, 0, 2, geo);

  mover.append(rollerGroup, spring);
  return { sensorLabel, cam };
}

/** The one-way roller's hinge, roller and how far off the axis the angled lever lifts it. */
const ONE_WAY_HINGE_X = 14;
const ONE_WAY_ROLLER_X = -2;
const ONE_WAY_ROLLER_RISE = 15;
const ONE_WAY_ROLLER_R = 10;

/** Whether a cam resting on the sensor `key` can only have got there moving `way` (+1
 * extending, -1 retracting): its range reaches the end of the stroke that way. */
function camArrivesTripping(key: string, way: 1 | -1): boolean {
  const range = sensorRangeOf(key);
  if (!range) return false;
  return way === 1 ? range.maxPct >= 100 : range.minPct <= 0;
}

export function createLimitValve32(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = LIMIT_VALVE_32_DEFAULT_GEOMETRY;
  const shell = buildComponentShell(
    compLayer,
    LIMIT_VALVE_32_TYPE,
    x,
    y,
    SVG_W,
    SVG_H,
    '3/2 limit valve',
    {
      x: SLIDING_VALVE_OFFSET_X,
      y: SLIDING_VALVE_OFFSET_Y,
      w: SLIDING_VALVE_W,
      h: SLIDING_VALVE_H,
    },
  );
  const valve = buildSlidingValve32Body(shell.svg, `arrow-limit-${uid()}`);
  shell.followFrame(valve.mover, valve.rest.x, valve.rest.y);
  let rollerKind: RollerKind = 'roller';
  const actuatorG = createSvgEl('g') as SVGGElement;
  valve.mover.appendChild(actuatorG);
  let { sensorLabel, cam } = drawLimitValve32Actuator(actuatorG, geo, rollerKind);
  function setRollerKind(kind: RollerKind): void {
    if (kind === rollerKind) return;
    rollerKind = kind;
    actuatorG.replaceChildren();
    ({ sensorLabel, cam } = drawLimitValve32Actuator(actuatorG, geo, rollerKind));
  }
  /** One-way roller: whether this run's sensor states have been read yet, whether its sensor
   * was on last time, and whether the cam on it holds the lever pressed. */
  let started = false;
  let wasOn = false;
  let pressed = false;

  const id = uid();

  let active = false;
  // Swaps the two cells so the valve passes 1 -> 2 at rest instead of blocking it, turning it
  // normally open - see pushButton32.ts, which this mirrors. Only the artwork and the rule
  // change: actuating still slides the mover the same way, so the actuator animates identically
  // either way round.
  let normallyOpen = false;

  /** True while 1 is connected through to 2, whichever combination of actuated and
   * normally-open produced it - both the symbol and the rule follow this one value. */
  function flowing(): boolean {
    return active !== normallyOpen;
  }
  // A freshly placed limit switch starts unbound rather than defaulting to some sensor - every
  // new one used to default to the same fixed key (or, later, "whichever is free"), either of
  // which still means guessing at a binding you'd probably change anyway. Starting blank also
  // makes swapping two switches' labels possible without relocating either: clear one, give its
  // label to the other, then give the first one what's now free.
  let sensorKey = '';
  let manualActive = false;

  // Two limit switches sharing a sensor is allowed (a real circuit might legitimately fan one
  // signal out to several valves) rather than blocked, but it's easy to do by accident (e.g.
  // two switches both left at a stale default) - flagging it in red is a middle ground between
  // silently allowing it and refusing to let the assignment happen at all. Rechecked on every
  // appState change (not just this switch's own), since the conflict can appear or disappear
  // because of what some *other* switch just did.
  function updateLabel(): void {
    sensorLabel.textContent = sensorKey || '';
    const duplicate = sensorKey !== '' && isSensorKeyBoundElsewhere(sensorKey, id);
    sensorLabel.classList.toggle('sensorLabelDuplicate', duplicate);
  }
  updateLabel();
  appState.onChange(updateLabel);

  /** Shows the valve actuated (or not), with the cam on its roller when it's its cylinder
   * holding it there. */
  function draw(actuated: boolean): void {
    valve.setActive(actuated);
    cam.style.display = actuated && sensorKey ? '' : 'none';
  }

  // While the simulation is stopped the valve is drawn in the circuit's initial position, as
  // circuit diagrams are: actuated if its cylinder rests on its sensor (e.g. a0 with the
  // cylinder retracted) - so it reads, and exports, the way it starts. Only the drawing:
  // `active`, what the simulation and the saved project go by, is untouched.
  function drawRestState(): void {
    if (appState.mode !== Modes.STOP) return;
    // A one-way roller is held down by a cam resting on it only if the cam got there the way
    // that presses it.
    const held =
      isSensorTriggeredAtRest(sensorKey) &&
      (rollerKind === 'roller' ||
        camArrivesTripping(sensorKey, rollerKind === 'oneWayExtend' ? 1 : -1));
    draw(sensorKey !== '' && held);
  }
  appState.onChange(drawRestState);
  appState.onModeChange(drawRestState);

  const comp: Component = {
    id,
    type: LIMIT_VALVE_32_TYPE,
    el: shell.el,
    x,
    y,
    svgW: SVG_W,
    svgH: SVG_H,
    gx: 0,
    gy: 0,
    ports: valve.ports,

    conductivityRule(): PortConnection[] {
      return flowing() ? [{ a: '2', b: '1' }] : [{ a: '2', b: '3' }];
    },

    recompute(): void {
      if (!sensorKey) active = manualActive;
      else if (rollerKind === 'roller') active = getSignal(sensorKey);
      else {
        const way = rollerKind === 'oneWayExtend' ? 1 : -1;
        // Before its cylinder has reported this run, the lever stays as it was.
        if (hasSignal(sensorKey)) {
          const on = getSignal(sensorKey);
          if (!started) {
            // The run starts with the cam on it: pressed if it can only have got there the
            // way that presses it.
            started = true;
            pressed = on && camArrivesTripping(sensorKey, way);
          } else if (on && !wasOn) {
            // The cam comes onto it: pressed coming the trip way, folded away the other way.
            const motion = getSignalMotion(sensorKey);
            pressed = motion === way || (motion === 0 && camArrivesTripping(sensorKey, way));
          }
          if (!on) pressed = false;
          wasOn = on;
        }
        active = pressed;
      }
      draw(active);
    },

    snapshot(): Record<string, unknown> {
      return {
        active,
        normallyOpen,
        sensorKey,
        ...(rollerKind === 'roller' ? {} : { roller: rollerKind }),
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3: valve.getSilencer(),
      };
    },
    restore(data: Record<string, unknown>): void {
      active = data.active as boolean;
      normallyOpen = Boolean(data.normallyOpen);
      sensorKey = data.sensorKey as string;
      setRollerKind(isRollerKind(data.roller) ? data.roller : 'roller');
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      valve.setSilencer((data.silencer3 as 'none' | 'silencer') ?? 'silencer');
      updateLabel();
      valve.setSwapped(normallyOpen);
      draw(active);
      drawRestState();
    },
    reset(): void {
      active = false;
      manualActive = false;
      started = false;
      wasOn = false;
      pressed = false;
      draw(false);
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

  valve.setActive(false);

  return comp;
}
