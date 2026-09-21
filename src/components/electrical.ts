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

/** The switching blade between the two fixed contact terminals: vertical while closed, swung
 * off to the side while open. NC contacts also get the short cross-bar the standard symbol
 * uses to tell them apart from NO ones at a glance. */
function drawContactSymbol(g: SVGElement, normallyClosed: boolean): {
  setClosed(closed: boolean): void;
  setNormallyClosed(nc: boolean): void;
  blade: SVGLineElement;
} {
  g.append(line(CX, TOP_Y, CX, CONTACT_TOP_Y), line(CX, CONTACT_BOT_Y, CX, BOT_Y));
  g.append(
    createSvgEl('circle', { cx: CX, cy: CONTACT_TOP_Y, r: 2.5, fill: STROKE }),
    createSvgEl('circle', { cx: CX, cy: CONTACT_BOT_Y, r: 2.5, fill: STROKE }),
  );
  const blade = line(CX, CONTACT_BOT_Y, CX, CONTACT_TOP_Y);
  const nc = line(CX - 8, CONTACT_TOP_Y + 4, CX + 8, CONTACT_TOP_Y + 12, 1.5);
  g.append(blade, nc);

  let closed = false;
  function apply(): void {
    blade.setAttribute('x2', String(closed ? CX : CX + 14));
    blade.setAttribute('y2', String(closed ? CONTACT_TOP_Y : CONTACT_TOP_Y + 6));
  }
  function setNormallyClosed(v: boolean): void {
    nc.style.display = v ? '' : 'none';
  }
  setNormallyClosed(normallyClosed);
  apply();

  return {
    blade,
    setClosed(v: boolean): void {
      closed = v;
      apply();
    },
    setNormallyClosed,
  };
}

function railComponent(
  compLayer: HTMLElement,
  x: number,
  y: number,
  kind: 'plus' | 'zero',
): Component {
  const w = 100;
  const h = 40;
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
  // Plus rail: bar on top with the terminal below it; zero rail: the mirror image.
  const barY = kind === 'plus' ? 12 : 28;
  const portY = kind === 'plus' ? 30 : 10;
  shell.svg.append(line(5, barY, w - 5, barY, 3), line(w / 2, barY, w / 2, portY));
  const label = textEl(w / 2 + 6, kind === 'plus' ? 8 : 38, 11, 'start');
  label.textContent = kind === 'plus' ? '+24 V' : '0 V';
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
  const label = textEl(CX + 12, CONTACT_TOP_Y - 4, 11, 'start');
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

/** A manually operated contact: held closed (NO) or open (NC) while the mouse is pressed on it
 * during a run; Ctrl+click latches it, like the pneumatic push button. */
export function createElecPushButton(compLayer: HTMLElement, x: number, y: number): Component {
  const { shell, g } = twoTerminalBase(compLayer, ELEC_PUSH_BUTTON_TYPE, x, y, 'Push button');
  let normallyClosed = false;
  let pressed = false;
  let latched = false;
  const symbol = drawContactSymbol(g, normallyClosed);
  // Dashed actuator link from the blade out to the push head.
  const head = createSvgEl('g');
  head.append(
    createSvgEl('line', {
      x1: CX + 2,
      y1: 50,
      x2: CX + 22,
      y2: 50,
      stroke: STROKE,
      'stroke-width': 1.5,
      'stroke-dasharray': '3 3',
    }),
    line(CX + 22, 42, CX + 22, 58),
  );
  g.appendChild(head);
  const ports = twoTerminalPorts(g);

  function isClosed(): boolean {
    return normallyClosed ? !pressed : pressed;
  }
  function refresh(): void {
    symbol.setNormallyClosed(normallyClosed);
    symbol.setClosed(isClosed());
    head.setAttribute('transform', pressed ? 'translate(-4,0)' : '');
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
