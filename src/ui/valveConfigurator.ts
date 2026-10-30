import type { Component } from '../core/types';
import { appState } from '../app/AppState';
import { removeConnection } from '../wires/connection';
import { swapComponentType } from '../interaction/valveActuatorSwap';
import { listAllSensorLabels } from '../components/shared/sensorPositions';
import { nextFreeSolenoidKeys } from '../components/solenoidValves';
import { VALVE_52_DEFAULT_GEOMETRY } from '../components/valve52';
import {
  ACTUATOR_52_LABELS,
  canBePilotOperated,
  configFromLegacy,
  LEFT_ACTUATORS,
  RIGHT_ACTUATORS,
  VALVE_52_CONFIGURABLE_TYPE,
  type Actuator52,
} from '../components/valve52Configurable';

/** Every 5/2 valve type the configurator can show - and turn into the configurable valve. */
export const CONFIGURABLE_52_TYPES = new Set<string>([
  'valve52',
  'valve52Mono',
  'valve52Solenoid',
  'valve52SolenoidDouble',
  VALVE_52_CONFIGURABLE_TYPE,
]);

/** The valve's own drawing, scaled to the inspector's width - its body and both ends. */
function preview(comp: Component): SVGSVGElement | null {
  const live = comp.el.querySelector<SVGSVGElement>('svg.compSvg');
  if (!live) return null;
  const svg = live.cloneNode(true) as SVGSVGElement;
  const geo = VALVE_52_DEFAULT_GEOMETRY;
  // The body at rest spans gx0 - w0 .. gx0 + w0; leave room for an actuator on either end.
  const x0 = geo.gx0 - geo.w0 - 62;
  const w = geo.w0 * 2 + 124;
  svg.setAttribute('viewBox', `${x0} 2 ${w} ${geo.h0 + geo.extraH + 2}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('class');
  svg.style.overflow = 'hidden';
  svg.classList.add('valveConfigPreview');
  for (const port of Array.from(svg.querySelectorAll('circle.port'))) port.remove();
  return svg;
}

function select<T extends string>(
  options: T[],
  labels: Record<T, string>,
  value: T,
  label: string,
  onChange: (v: T) => void,
): HTMLSelectElement {
  const el = document.createElement('select');
  el.setAttribute('aria-label', label);
  el.title = label;
  for (const o of options) el.append(new Option(labels[o], o));
  el.value = value;
  el.addEventListener('change', () => onChange(el.value as T));
  return el;
}

/**
 * The 5/2 valve's actuation, set visually: the valve drawn as it is, a dropdown under each end
 * choosing what shifts it from there - air pilot, solenoid, push button, roller, or (right end)
 * a return spring - then the coil names / sensors those need, whether the actuation is
 * pilot-operated, and where a bistable valve starts. A change to one of the fixed 5/2 types turns
 * it into the configurable valve in place, keeping its wires.
 */
export function renderValveConfigurator(container: HTMLElement, comp: Component): void {
  const cfg = configFromLegacy(comp.type, comp.snapshot());
  if (!cfg) return;
  const left = (cfg.left as Actuator52) ?? 'air';
  const right = (cfg.right as Actuator52) ?? 'air';

  function apply(change: Record<string, unknown>): void {
    const next: Record<string, unknown> = { ...cfg, ...change };
    // A newly chosen solenoid gets a coil name nobody else uses yet.
    for (const [side, key] of [
      ['left', 'key14'],
      ['right', 'key12'],
    ] as const) {
      if (next[side] === 'solenoid' && !next[key]) next[key] = nextFreeSolenoidKeys(1)[0] ?? 'Y1';
    }
    const target =
      comp.type === VALVE_52_CONFIGURABLE_TYPE
        ? comp
        : swapComponentType(comp, VALVE_52_CONFIGURABLE_TYPE);
    if (!target) return;
    // An end that no longer has an air pilot has no pilot port: its wire goes.
    for (const [side, port] of [
      ['left', '14'],
      ['right', '12'],
    ] as const) {
      if (next[side] === 'air') continue;
      for (const conn of [...appState.connections]) {
        const onIt =
          (conn.from.id === target.id && conn.from.port === port) ||
          (conn.to.id === target.id && conn.to.port === port);
        if (onIt) removeConnection(conn.id);
      }
    }
    target.restore({ ...target.snapshot(), ...next });
    appState.markDirty();
  }

  const heading = document.createElement('div');
  heading.className = 'inspectorSectionHeading';
  heading.textContent = 'Actuation';
  container.appendChild(heading);

  const view = preview(comp);
  if (view) container.appendChild(view);

  const ends = document.createElement('div');
  ends.className = 'valveConfigEnds';
  ends.append(
    select(LEFT_ACTUATORS, ACTUATOR_52_LABELS, left, 'Left end (14)', (v) => apply({ left: v })),
    select(RIGHT_ACTUATORS, ACTUATOR_52_LABELS, right, 'Right end (12)', (v) =>
      apply({ right: v }),
    ),
  );
  container.appendChild(ends);

  // What each end needs to know: a coil name, or which sensor its roller reads.
  const sensors = listAllSensorLabels();
  for (const [kind, keyField, sensorField, label] of [
    [left, 'key14', 'sensor14', 'Left'],
    [right, 'key12', 'sensor12', 'Right'],
  ] as const) {
    if (kind !== 'solenoid' && kind !== 'roller') continue;
    const row = document.createElement('label');
    row.className = 'inspectorRow';
    const span = document.createElement('span');
    span.textContent = kind === 'solenoid' ? `${label} coil` : `${label} roller sensor`;
    row.appendChild(span);
    if (kind === 'solenoid') {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(cfg[keyField] ?? '');
      input.addEventListener('change', () => apply({ [keyField]: input.value.trim() }));
      row.appendChild(input);
    } else {
      const sel = document.createElement('select');
      sel.append(new Option('(none)', ''));
      for (const s of sensors) sel.append(new Option(`${s.label} (${s.cylinderName})`, s.label));
      const current = String(cfg[sensorField] ?? '');
      if (current && !sensors.some((s) => s.label.toUpperCase() === current.toUpperCase())) {
        sel.append(new Option(`${current} (not found)`, current));
      }
      sel.value = current;
      sel.addEventListener('change', () => apply({ [sensorField]: sel.value }));
      row.appendChild(sel);
    }
    container.appendChild(row);
  }

  if (canBePilotOperated(left) || canBePilotOperated(right)) {
    const row = document.createElement('label');
    row.className = 'inspectorRow inspectorCheckboxRow';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = Boolean(cfg.pilotOperated);
    box.addEventListener('change', () => apply({ pilotOperated: box.checked }));
    row.append(box, document.createTextNode(' Pilot operated (needs pressure at 1)'));
    container.appendChild(row);
  }

  if (right !== 'spring') {
    const row = document.createElement('label');
    row.className = 'inspectorRow';
    const span = document.createElement('span');
    span.textContent = 'Starts in';
    const sel = document.createElement('select');
    sel.append(new Option('1→2 (right box)', '1'), new Option('1→4 (left box)', '0'));
    sel.value = cfg.startPos === 0 ? '0' : '1';
    sel.addEventListener('change', () => apply({ startPos: sel.value === '0' ? 0 : 1 }));
    row.append(span, sel);
    container.appendChild(row);
  }
}
