import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { getSignal } from '../sim/signals';
import { buildComponentShell, createSvgEl } from './shared/svgHelpers';
import { setSilencerState, type SilencerOption } from './shared/silencer';
import { VALVE_52_MONO_DEFAULT_GEOMETRY, drawValve52MonoBody } from './valve52Mono';
import { VALVE_52_DEFAULT_GEOMETRY, drawValve52Body } from './valve52';

export const VALVE_52_SOLENOID_TYPE = 'valve52Solenoid';
export const VALVE_52_SOLENOID_DOUBLE_TYPE = 'valve52SolenoidDouble';

const STROKE = 2;

/** Replaces a pneumatic pilot (triangle + port) with a solenoid actuator: the standard box with
 * a diagonal stroke, joined to the valve body, with its coil name above. `side` says which end
 * of the body it hangs off. Returns the name text so the caller can keep it in sync. */
function drawSolenoid(
  group: SVGElement,
  side: 'left' | 'right',
  bodyEdgeX: number,
  cy: number,
): SVGTextElement {
  while (group.firstChild) group.removeChild(group.firstChild);
  const dir = side === 'left' ? -1 : 1;
  const gap = 8;
  const w = 26;
  const h = 24;
  const near = bodyEdgeX + dir * gap;
  const far = near + dir * w;
  const x0 = Math.min(near, far);
  group.append(
    createSvgEl('line', {
      x1: bodyEdgeX,
      y1: cy,
      x2: near,
      y2: cy,
      stroke: '#111',
      'stroke-width': STROKE,
    }),
    createSvgEl('rect', {
      x: x0,
      y: cy - h / 2,
      width: w,
      height: h,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': STROKE,
    }),
    createSvgEl('line', {
      x1: x0,
      y1: cy + h / 2,
      x2: x0 + w,
      y2: cy - h / 2,
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );
  const label = createSvgEl('text', {
    x: x0 + w / 2,
    y: cy - h / 2 - 5,
    'text-anchor': 'middle',
    'font-size': 11,
    fill: '#111',
  });
  group.appendChild(label);
  return label;
}

/** A 5/2 valve shifted by one solenoid against a return spring: energizing the coil with the
 * same name (default "Y1") moves it to the left position, de-energizing lets the spring return
 * it. Its 1-5 ports and silencer options are the pneumatic 5/2 monostable valve's. */
export function createValve52Solenoid(compLayer: HTMLElement, x: number, y: number): Component {
  const geo = VALVE_52_MONO_DEFAULT_GEOMETRY;
  const svgW = geo.w0 * 2 + geo.extraW;
  const svgH = geo.h0 + geo.extraH;
  const shell = buildComponentShell(
    compLayer,
    VALVE_52_SOLENOID_TYPE,
    x,
    y,
    svgW,
    svgH,
    '5/2 solenoid valve',
    { x: geo.gx0 - geo.w0, y: geo.gy0, w: geo.w0 * 2, h: geo.h0 },
  );
  const svg = shell.svg;
  svg.style.overflow = 'visible';

  const body = drawValve52MonoBody(svg, geo, `arrow-v52s-${uid()}`);
  const pilotGroup = body.gInner.lastElementChild as SVGElement;
  const nameEl = drawSolenoid(pilotGroup, 'left', 0, geo.h0 / 2);

  let key = 'Y1';
  let silencer3: SilencerOption = 'silencer';
  let silencer5: SilencerOption = 'silencer';
  let state: 0 | 1 = 1;

  function applyState(): void {
    body.gInner.setAttribute(
      'transform',
      `translate(${geo.gx0 + (state === 0 ? 0 : -body.midX)},${geo.gy0})`,
    );
  }
  function refreshLabel(): void {
    nameEl.textContent = key;
  }
  refreshLabel();
  applyState();

  const comp: Component = {
    id: uid(),
    type: VALVE_52_SOLENOID_TYPE,
    el: shell.el,
    x,
    y,
    svgW,
    svgH,
    gx: 0,
    gy: 0,
    ports: { ...body.fixedPorts },

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

    recompute(): void {
      state = key && getSignal(key) ? 0 : 1;
      applyState();
    },

    snapshot(): Record<string, unknown> {
      return {
        key,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3,
        silencer5,
      };
    },
    restore(data: Record<string, unknown>): void {
      key = (data.key as string) ?? key;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      silencer3 = (data.silencer3 as SilencerOption) ?? 'silencer';
      silencer5 = (data.silencer5 as SilencerOption) ?? 'silencer';
      setSilencerState(body.fixedPorts['3'], body.silencer3El, silencer3);
      setSilencerState(body.fixedPorts['5'], body.silencer5El, silencer5);
      refreshLabel();
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

/** A 5/2 valve with a solenoid at each end and no spring - it stays wherever it was last
 * switched. The left coil (default "Y1") shifts it to the left position, the right one
 * (default "Y2") to the right; energizing both at once, or neither, leaves it as it is. */
export function createValve52SolenoidDouble(
  compLayer: HTMLElement,
  x: number,
  y: number,
): Component {
  const geo = VALVE_52_DEFAULT_GEOMETRY;
  const svgW = geo.w0 * 2 + geo.extraW;
  const svgH = geo.h0 + geo.extraH;
  const shell = buildComponentShell(
    compLayer,
    VALVE_52_SOLENOID_DOUBLE_TYPE,
    x,
    y,
    svgW,
    svgH,
    '5/2 double solenoid valve',
    { x: geo.gx0 - geo.w0, y: geo.gy0, w: geo.w0 * 2, h: geo.h0 },
  );
  const svg = shell.svg;
  svg.style.overflow = 'visible';

  const body = drawValve52Body(svg, geo, `arrow-v52sd-${uid()}`);
  // gInner's children are [slide, right pilot (12), left pilot (14)].
  const rightGroup = body.gInner.children[1] as SVGElement;
  const leftGroup = body.gInner.children[2] as SVGElement;
  const leftName = drawSolenoid(leftGroup, 'left', 0, geo.h0 / 2);
  const rightName = drawSolenoid(rightGroup, 'right', geo.w0 * 2, geo.h0 / 2);

  let key14 = 'Y1';
  let key12 = 'Y2';
  let silencer3: SilencerOption = 'silencer';
  let silencer5: SilencerOption = 'silencer';
  let state: 0 | 1 = 1;
  let prev14 = false;
  let prev12 = false;

  function applyState(): void {
    body.gInner.setAttribute(
      'transform',
      `translate(${geo.gx0 + (state === 0 ? 0 : -body.midX)},${geo.gy0})`,
    );
  }
  function refreshLabels(): void {
    leftName.textContent = key14;
    rightName.textContent = key12;
  }
  refreshLabels();
  applyState();

  const comp: Component = {
    id: uid(),
    type: VALVE_52_SOLENOID_DOUBLE_TYPE,
    el: shell.el,
    x,
    y,
    svgW,
    svgH,
    gx: 0,
    gy: 0,
    ports: { ...body.fixedPorts },

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

    // Same rule as the double-pilot pneumatic valve: a coil that just energized moves the valve
    // only if the opposite one isn't held on; once that one lets go, the one still held takes over.
    recompute(): void {
      const s14 = key14 ? getSignal(key14) : false;
      const s12 = key12 ? getSignal(key12) : false;
      if (s12 && !prev12 && !s14) state = 1;
      else if (s14 && !prev14 && !s12) state = 0;
      else if (!s14 && prev14 && s12) state = 1;
      else if (!s12 && prev12 && s14) state = 0;
      prev14 = s14;
      prev12 = s12;
      applyState();
    },

    snapshot(): Record<string, unknown> {
      return {
        state,
        key14,
        key12,
        showName: shell.getNameVisible(),
        customName: shell.getCustomName(),
        silencer3,
        silencer5,
      };
    },
    restore(data: Record<string, unknown>): void {
      state = (data.state as 0 | 1) ?? 1;
      key14 = (data.key14 as string) ?? key14;
      key12 = (data.key12 as string) ?? key12;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      silencer3 = (data.silencer3 as SilencerOption) ?? 'silencer';
      silencer5 = (data.silencer5 as SilencerOption) ?? 'silencer';
      setSilencerState(body.fixedPorts['3'], body.silencer3El, silencer3);
      setSilencerState(body.fixedPorts['5'], body.silencer5El, silencer5);
      refreshLabels();
      applyState();
    },
    reset(): void {
      state = 1;
      prev14 = false;
      prev12 = false;
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
