import type { Component, PortConnection } from '../core/types';
import { uid } from '../core/ids';
import { appState } from '../app/AppState';
import { Modes } from '../app/modes';
import { getSignal } from '../sim/signals';
import { buildComponentShell, createPort, createSvgEl } from './shared/svgHelpers';

export const ELEC_RAIL_PLUS_TYPE = 'elecRailPlus';
export const ELEC_RAIL_ZERO_TYPE = 'elecRailZero';
export const ELEC_CONTACT_TYPE = 'elecContact';
export const ELEC_PUSH_BUTTON_TYPE = 'elecPushButton';
export const ELEC_CHANGEOVER_TYPE = 'elecChangeover';
export const ELEC_COIL_TYPE = 'elecCoil';
export const ELEC_LAMP_TYPE = 'elecLamp';

// Every two-terminal part (contacts, coil, lamp, push button) shares one canvas: terminals A
// (top) and B (bottom) 80px apart on the vertical centerline, so both land on the 10px grid
// relative to the canvas's own center (see src/core/grid.ts) and parts stack straight into a
// ladder-style diagram.
const TWO_TERMINAL_W = 60;
const TWO_TERMINAL_H = 100;
const CX = TWO_TERMINAL_W / 2;
const TOP_Y = 10;
const BOT_Y = TWO_TERMINAL_H - 10;
const CONTACT_TOP_Y = 34;
const CONTACT_BOT_Y = 66;

const STROKE = '#111';

function line(x1: number, y1: number, x2: number, y2: number, width = 2): SVGLineElement {
  return createSvgEl('line', { x1, y1, x2, y2, stroke: STROKE, 'stroke-width': width });
}

function textEl(x: number, y: number, size: number, anchor = 'middle'): SVGTextElement {
  return createSvgEl('text', { x, y, 'text-anchor': anchor, 'font-size': size, fill: STROKE });
}

/** The smallest unused `${prefix}${n}` among `type` components' `key`, so a freshly placed coil
 * doesn't start out sharing a name with one already in the diagram. */
function nextFreeKey(prefix: string, type: string): string {
  const used = new Set(
    appState.components
      .filter((c) => c.type === type)
      .map((c) => String((c.snapshot() as Record<string, unknown>).key ?? '').toUpperCase()),
  );
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

interface ElecBase {
  shell: ReturnType<typeof buildComponentShell>;
  g: SVGGElement;
}

function twoTerminalBase(
  compLayer: HTMLElement,
  type: string,
  x: number,
  y: number,
  label: string,
): ElecBase {
  const shell = buildComponentShell(compLayer, type, x, y, TWO_TERMINAL_W, TWO_TERMINAL_H, label, {
    x: 8,
    y: 0,
    w: TWO_TERMINAL_W - 16,
    h: TWO_TERMINAL_H,
  });
  const g = createSvgEl('g');
  shell.svg.appendChild(g);
  return { shell, g };
}

function twoTerminalPorts(g: SVGElement): Component['ports'] {
  return {
    A: createPort(g, 'A', CX, TOP_Y, 'V', { electrical: true }),
    B: createPort(g, 'B', CX, BOT_Y, 'V', { electrical: true }),
  };
}

/** IEC 60617 make/break contact drawn vertically: the blade pivots on the lower fixed contact.
 * NO (07-02-01): at rest the blade leans off to the left, short of the upper contact. NC
 * (07-02-03): the upper contact has a short hook to the right, and at rest the blade leans
 * right and rests against the hook. Actuated, an NO blade stands straight up onto the upper
 * contact and an NC blade swings clear of the hook, back to the NO rest position. */
function drawContactSymbol(g: SVGElement, normallyClosed: boolean): {
  setClosed(closed: boolean): void;
  setNormallyClosed(nc: boolean): void;
  /** Midpoint of the blade, where an actuator's mechanical link attaches. */
  bladeMid(): { x: number; y: number };
} {
  g.append(line(CX, TOP_Y, CX, CONTACT_TOP_Y), line(CX, CONTACT_BOT_Y, CX, BOT_Y));
  const hook = line(CX, CONTACT_TOP_Y, CX + 10, CONTACT_TOP_Y);
  const blade = line(CX, CONTACT_BOT_Y, CX, CONTACT_TOP_Y);
  g.append(hook, blade);

  let nc = normallyClosed;
  let closed = normallyClosed;
  let end = { x: CX, y: CONTACT_TOP_Y };
  function apply(): void {
    if (closed) end = nc ? { x: CX + 14, y: CONTACT_TOP_Y - 3 } : { x: CX, y: CONTACT_TOP_Y };
    else end = { x: CX - 13, y: CONTACT_TOP_Y + 3 };
    blade.setAttribute('x2', String(end.x));
    blade.setAttribute('y2', String(end.y));
    hook.style.display = nc ? '' : 'none';
  }
  apply();

  return {
    setClosed(v: boolean): void {
      closed = v;
      apply();
    },
    setNormallyClosed(v: boolean): void {
      nc = v;
      apply();
    },
    bladeMid: () => ({ x: (CX + end.x) / 2, y: (CONTACT_BOT_Y + end.y) / 2 }),
  };
}

function railComponent(
  compLayer: HTMLElement,
  x: number,
  y: number,
  kind: 'plus' | 'zero',
): Component {
  // Upright and narrow like FluidSIM's electrical connections, so it sits directly above (+24 V)
  // or below (0 V) the current path it feeds. The port stays 20px off the canvas center, on grid.
  const w = 40;
  const h = 60;
  const type = kind === 'plus' ? ELEC_RAIL_PLUS_TYPE : ELEC_RAIL_ZERO_TYPE;
  const shell = buildComponentShell(
    compLayer,
    type,
    x,
    y,
    w,
    h,
    kind === 'plus' ? '+24 V supply' : '0 V supply',
    { x: 5, y: 0, w: w - 10, h },
  );
  // IEC 60617 terminal (03-02-02, an open circle) with the conductor running to the port: the
  // plus supply feeds down from above, the zero supply returns up from below. The voltage is
  // written on the far side of the terminal, as in FluidSIM.
  const TERM_R = 4;
  const termY = kind === 'plus' ? 22 : 38;
  const portY = kind === 'plus' ? 50 : 10;
  shell.svg.append(
    line(w / 2, kind === 'plus' ? termY + TERM_R : termY - TERM_R, w / 2, portY),
    createSvgEl('circle', {
      cx: w / 2,
      cy: termY,
      r: TERM_R,
      fill: '#fff',
      stroke: STROKE,
      'stroke-width': 2,
    }),
  );
  const label = textEl(w / 2, kind === 'plus' ? termY - TERM_R - 4 : termY + TERM_R + 12, 11);
  label.textContent = kind === 'plus' ? '+24V' : '0V';
  shell.svg.appendChild(label);
  const ports = { P: createPort(shell.svg, 'P', w / 2, portY, 'V', { electrical: true }) };

  const comp: Component = {
    id: uid(),
    type,
    el: shell.el,
    x,
    y,
    svgW: w,
    svgH: h,
    gx: 0,
    gy: 0,
    ports,
    electrical: { role: { kind, port: 'P' } },
    conductivityRule: (): PortConnection[] => [],
    snapshot: () => ({ showName: shell.getNameVisible(), customName: shell.getCustomName() }),
    restore(data: Record<string, unknown>): void {
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
    },
    reset(): void {},
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

export function createElecRailPlus(compLayer: HTMLElement, x: number, y: number): Component {
  return railComponent(compLayer, x, y, 'plus');
}

export function createElecRailZero(compLayer: HTMLElement, x: number, y: number): Component {
  return railComponent(compLayer, x, y, 'zero');
}

/**
 * A contact driven by a named signal: a relay contact (key = the relay coil's name, e.g. "K1")
 * or a cylinder position sensor (key = the sensor label, e.g. "A1"), normally open or normally
 * closed. Reads the same signal bus the coils and cylinders publish to.
 */
export function createElecContact(compLayer: HTMLElement, x: number, y: number): Component {
  const { shell, g } = twoTerminalBase(compLayer, ELEC_CONTACT_TYPE, x, y, 'Contact');
  let key = '';
  let normallyClosed = false;
  let closed = false;
  const symbol = drawContactSymbol(g, normallyClosed);
  // Above the NC hook / blade tip, beside the upper conductor.
  const label = textEl(CX + 5, CONTACT_TOP_Y - 10, 11, 'start');
  g.appendChild(label);
  const ports = twoTerminalPorts(g);

  function refreshLabel(): void {
    label.textContent = key;
    symbol.setNormallyClosed(normallyClosed);
  }
  refreshLabel();

  const comp: Component = {
    id: uid(),
    type: ELEC_CONTACT_TYPE,
    el: shell.el,
    x,
    y,
    svgW: TWO_TERMINAL_W,
    svgH: TWO_TERMINAL_H,
    gx: 0,
    gy: 0,
    ports,
    electrical: {
      closedEdges: (): PortConnection[] => (closed ? [{ a: 'A', b: 'B' }] : []),
    },
    conductivityRule: (): PortConnection[] => [],
    recompute(): void {
      const sig = key ? getSignal(key) : false;
      closed = normallyClosed ? !sig : sig;
      symbol.setClosed(closed);
    },
    snapshot: () => ({
      key,
      normallyClosed,
      showName: shell.getNameVisible(),
      customName: shell.getCustomName(),
    }),
    restore(data: Record<string, unknown>): void {
      key = (data.key as string) ?? '';
      normallyClosed = Boolean(data.normallyClosed);
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      refreshLabel();
      comp.recompute?.();
    },
    reset(): void {
      closed = false;
      comp.recompute?.();
    },
    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };
  comp.recompute?.();
  return comp;
}

/**
 * A changeover contact (växelkontakt, IEC 60617 07-02-04) driven by a named signal, like
 * {@link createElecContact}: the common terminal (bottom) connects to NC (top left) at rest and
 * switches over to NO (top right, in line with the common) while the signal is on.
 */
export function createElecChangeover(compLayer: HTMLElement, x: number, y: number): Component {
  const { shell, g } = twoTerminalBase(compLayer, ELEC_CHANGEOVER_TYPE, x, y, 'Changeover');
  const NC_X = CX - 20;
  let key = '';
  let operated = false;
  g.append(
    line(CX, CONTACT_BOT_Y, CX, BOT_Y),
    line(CX, TOP_Y, CX, CONTACT_TOP_Y),
    line(NC_X, TOP_Y, NC_X, CONTACT_TOP_Y),
    line(NC_X, CONTACT_TOP_Y, NC_X + 10, CONTACT_TOP_Y),
  );
  const blade = line(CX, CONTACT_BOT_Y, CX, CONTACT_TOP_Y);
  g.appendChild(blade);
  const label = textEl(CX + 5, CONTACT_TOP_Y - 10, 11, 'start');
  g.appendChild(label);
  const ports: Component['ports'] = {
    NC: createPort(g, 'NC', NC_X, TOP_Y, 'V', { electrical: true }),
    NO: createPort(g, 'NO', CX, TOP_Y, 'V', { electrical: true }),
    COM: createPort(g, 'COM', CX, BOT_Y, 'V', { electrical: true }),
  };

  function refresh(): void {
    label.textContent = key;
    // At rest the blade leans left past the NC hook; operated it stands up onto the NO contact.
    blade.setAttribute('x2', String(operated ? CX : NC_X + 6));
    blade.setAttribute('y2', String(operated ? CONTACT_TOP_Y : CONTACT_TOP_Y - 3));
  }
  refresh();

  const comp: Component = {
    id: uid(),
    type: ELEC_CHANGEOVER_TYPE,
    el: shell.el,
    x,
    y,
    svgW: TWO_TERMINAL_W,
    svgH: TWO_TERMINAL_H,
    gx: 0,
    gy: 0,
    ports,
    electrical: {
      closedEdges: (): PortConnection[] => [{ a: 'COM', b: operated ? 'NO' : 'NC' }],
    },
    conductivityRule: (): PortConnection[] => [],
    recompute(): void {
      operated = key ? getSignal(key) : false;
      refresh();
    },
    snapshot: () => ({
      key,
      showName: shell.getNameVisible(),
      customName: shell.getCustomName(),
    }),
    restore(data: Record<string, unknown>): void {
      key = (data.key as string) ?? '';
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      comp.recompute?.();
    },
    reset(): void {
      comp.recompute?.();
    },
    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };
  comp.recompute?.();
  return comp;
}

/** A manually operated contact: held closed (NO) or open (NC) while the mouse is pressed on it
 * during a run; Ctrl+click latches it, like the pneumatic push button. */
export function createElecPushButton(compLayer: HTMLElement, x: number, y: number): Component {
  const { shell, g } = twoTerminalBase(compLayer, ELEC_PUSH_BUTTON_TYPE, x, y, 'Push button');
  let normallyClosed = false;
  let pressed = false;
  let latched = false;
  const symbol = drawContactSymbol(g, normallyClosed);
  // IEC 60617 02-13-05 "operated by pushing": a "[" bracket on the left, joined to the blade by
  // a dashed mechanical link (02-12-01). Pressing slides the bracket toward the contact.
  const HEAD_X = CX - 20;
  const HEAD_Y = 50;
  const link = createSvgEl('line', {
    x1: HEAD_X,
    y1: HEAD_Y,
    x2: CX,
    y2: HEAD_Y,
    stroke: STROKE,
    'stroke-width': 1.5,
    'stroke-dasharray': '3 2',
  });
  const head = createSvgEl('path', {
    d: `M ${HEAD_X + 4} ${HEAD_Y - 8} H ${HEAD_X} V ${HEAD_Y + 8} H ${HEAD_X + 4}`,
    fill: 'none',
    stroke: STROKE,
    'stroke-width': 2,
  });
  g.append(link, head);
  const ports = twoTerminalPorts(g);

  function isClosed(): boolean {
    return normallyClosed ? !pressed : pressed;
  }
  function refresh(): void {
    symbol.setNormallyClosed(normallyClosed);
    symbol.setClosed(isClosed());
    const shift = pressed ? 4 : 0;
    head.setAttribute('transform', shift ? `translate(${shift},0)` : '');
    const mid = symbol.bladeMid();
    link.setAttribute('x1', String(HEAD_X + shift));
    link.setAttribute('x2', String(mid.x));
    link.setAttribute('y1', String(mid.y));
    link.setAttribute('y2', String(mid.y));
  }
  refresh();

  const comp: Component = {
    id: uid(),
    type: ELEC_PUSH_BUTTON_TYPE,
    el: shell.el,
    x,
    y,
    svgW: TWO_TERMINAL_W,
    svgH: TWO_TERMINAL_H,
    gx: 0,
    gy: 0,
    ports,
    electrical: {
      closedEdges: (): PortConnection[] => (isClosed() ? [{ a: 'A', b: 'B' }] : []),
    },
    conductivityRule: (): PortConnection[] => [],
    snapshot: () => ({
      normallyClosed,
      showName: shell.getNameVisible(),
      customName: shell.getCustomName(),
    }),
    restore(data: Record<string, unknown>): void {
      normallyClosed = Boolean(data.normallyClosed);
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      refresh();
    },
    reset(): void {
      pressed = false;
      latched = false;
      refresh();
    },
    setPos(nx: number, ny: number): void {
      comp.x = nx;
      comp.y = ny;
      shell.setPos(nx, ny);
    },
    getBounds: shell.getBounds,
    setSelected: shell.setSelected,
  };

  function setPressed(v: boolean): void {
    if (pressed === v) return;
    pressed = v;
    refresh();
  }
  shell.svg.addEventListener('mousedown', (e) => {
    if (appState.mode === Modes.STOP) return;
    if (latched) {
      latched = false;
      setPressed(false);
      return;
    }
    if (e.ctrlKey) latched = true;
    setPressed(true);
  });
  window.addEventListener('mouseup', () => {
    if (!latched) setPressed(false);
  });
  shell.svg.addEventListener('mouseleave', () => {
    if (!latched) setPressed(false);
  });

  return comp;
}

/** A relay or solenoid coil. While energized it publishes its name on the signal bus: contacts
 * with the same key follow it (a relay), and a solenoid valve with the same key shifts. */
export function createElecCoil(compLayer: HTMLElement, x: number, y: number): Component {
  const { shell, g } = twoTerminalBase(compLayer, ELEC_COIL_TYPE, x, y, 'Coil');
  let key = nextFreeKey('Y', ELEC_COIL_TYPE);
  const body = createSvgEl('rect', {
    x: CX - 14,
    y: 30,
    width: 28,
    height: 40,
    fill: '#fff',
    stroke: STROKE,
    'stroke-width': 2,
  });
  g.append(line(CX, TOP_Y, CX, 30), line(CX, 70, CX, BOT_Y), body);
  const label = textEl(CX, 54, 11);
  g.appendChild(label);
  const ports = twoTerminalPorts(g);

  function refreshLabel(): void {
    label.textContent = key;
  }
  refreshLabel();

  const comp: Component = {
    id: uid(),
    type: ELEC_COIL_TYPE,
    el: shell.el,
    x,
    y,
    svgW: TWO_TERMINAL_W,
    svgH: TWO_TERMINAL_H,
    gx: 0,
    gy: 0,
    ports,
    electrical: {
      get load() {
        return { a: 'A', b: 'B', key };
      },
      setEnergized(v: boolean): void {
        body.setAttribute('fill', v ? '#ffd966' : '#fff');
      },
    },
    conductivityRule: (): PortConnection[] => [],
    snapshot: () => ({
      key,
      showName: shell.getNameVisible(),
      customName: shell.getCustomName(),
    }),
    restore(data: Record<string, unknown>): void {
      key = (data.key as string) ?? key;
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
      refreshLabel();
    },
    reset(): void {
      comp.electrical?.setEnergized?.(false);
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

export function createElecLamp(compLayer: HTMLElement, x: number, y: number): Component {
  const { shell, g } = twoTerminalBase(compLayer, ELEC_LAMP_TYPE, x, y, 'Lamp');
  const bulb = createSvgEl('circle', {
    cx: CX,
    cy: 50,
    r: 14,
    fill: '#fff',
    stroke: STROKE,
    'stroke-width': 2,
  });
  g.append(
    line(CX, TOP_Y, CX, 36),
    line(CX, 64, CX, BOT_Y),
    bulb,
    line(CX - 10, 40, CX + 10, 60),
    line(CX - 10, 60, CX + 10, 40),
  );
  const ports = twoTerminalPorts(g);

  const comp: Component = {
    id: uid(),
    type: ELEC_LAMP_TYPE,
    el: shell.el,
    x,
    y,
    svgW: TWO_TERMINAL_W,
    svgH: TWO_TERMINAL_H,
    gx: 0,
    gy: 0,
    ports,
    electrical: {
      load: { a: 'A', b: 'B', key: '' },
      setEnergized(v: boolean): void {
        bulb.setAttribute('fill', v ? '#ffe45c' : '#fff');
      },
    },
    conductivityRule: (): PortConnection[] => [],
    snapshot: () => ({ showName: shell.getNameVisible(), customName: shell.getCustomName() }),
    restore(data: Record<string, unknown>): void {
      shell.setNameVisible(Boolean(data.showName));
      shell.setCustomName((data.customName as string | null) ?? null);
    },
    reset(): void {
      comp.electrical?.setEnergized?.(false);
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
