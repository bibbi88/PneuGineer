import type { Component } from '../core/types';
import { appState } from '../app/AppState';
import { removeConnection } from '../wires/connection';
import { swapComponentType } from '../interaction/valveActuatorSwap';
import { listAllSensorLabels } from '../components/shared/sensorPositions';
import { nextFreeSolenoidKeys } from '../components/solenoidValves';
import { VALVE_52_DEFAULT_GEOMETRY } from '../components/valve52';
import {
  ACTUATOR_LABELS,
  PILOT_SUPPLY_LABELS,
  readPilotSupply,
  type Actuator,
  type PilotSupply,
} from '../components/shared/valveActuators';
import {
  configFromLegacy,
  LEFT_ACTUATORS,
  RIGHT_ACTUATORS,
  VALVE_52_CONFIGURABLE_TYPE,
} from '../components/valve52Configurable';
import {
  CENTRE_53_LABELS,
  END_ACTUATORS_53,
  VALVE_53_CONFIGURABLE_TYPE,
  type Centre53,
} from '../components/valve53Configurable';

/** The fixed 5/3 types, and the configurable valve settings each amounts to. */
function config53FromLegacy(
  type: string,
  snap: Record<string, unknown>,
): Record<string, unknown> | null {
  const common = {
    showName: snap.showName,
    customName: snap.customName,
    silencer3: snap.silencer3,
    silencer5: snap.silencer5,
  };
  if (type === 'valve53Mono') return { ...common, left: 'air', right: 'air', centre: 'closed' };
  if (type === 'valve53Solenoid') {
    return {
      ...common,
      left: 'solenoid',
      right: 'solenoid',
      key14: snap.key14,
      key12: snap.key12,
      centre: 'closed',
    };
  }
  if (type === VALVE_53_CONFIGURABLE_TYPE) return { ...snap };
  return null;
}

/** The valve's own drawing, scaled to the inspector's width - its body and both ends. */
function preview(comp: Component, cells: 2 | 3): SVGSVGElement | null {
  const live = comp.el.querySelector<SVGSVGElement>('svg.compSvg');
  if (!live) return null;
  const svg = live.cloneNode(true) as SVGSVGElement;
  const geo = VALVE_52_DEFAULT_GEOMETRY;
  // The body at rest starts at gx0 - w0; leave room for an actuator on either end.
  const x0 = geo.gx0 - geo.w0 - 62;
  const w = geo.w0 * cells + 124;
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

function row(label: string, control: HTMLElement): HTMLElement {
  const r = document.createElement('label');
  r.className = 'inspectorRow';
  const span = document.createElement('span');
  span.textContent = label;
  r.append(span, control);
  return r;
}

/** Removes the wires on `ports` of `comp`. */
function unwire(comp: Component, ports: string[]): void {
  for (const conn of [...appState.connections]) {
    const onIt =
      (conn.from.id === comp.id && ports.includes(conn.from.port)) ||
      (conn.to.id === comp.id && ports.includes(conn.to.port));
    if (onIt) removeConnection(conn.id);
  }
}

/**
 * A 5/2 or 5/3 valve's actuation, set visually: the valve drawn as it is, a dropdown under each
 * end choosing what shifts it from there - air pilot, solenoid, push button, roller, or (right
 * end of a 5/2) a return spring - then whether it's a 5/2 or a 5/3 and a 5/3's centre, the coil
 * names / sensors the ends need, the pilot stage, and where a bistable 5/2 starts. A change to
 * one of the fixed valve types turns it into the configurable valve in place, keeping its wires.
 */
export function renderValveConfigurator(container: HTMLElement, comp: Component): void {
  const snap = comp.snapshot();
  const cfg52 = configFromLegacy(comp.type, snap);
  const cfg53 = config53FromLegacy(comp.type, snap);
  const cfg = cfg53 ?? cfg52;
  if (!cfg) return;
  const cells: 2 | 3 = cfg53 ? 3 : 2;
  const left = (cfg.left as Actuator) ?? 'air';
  const right = (cfg.right as Actuator) ?? 'air';
  const pilot = readPilotSupply(cfg);

  function apply(change: Record<string, unknown>, nextCells: 2 | 3 = cells): void {
    const next: Record<string, unknown> = { ...cfg, ...change };
    // A 5/3 is spring-centred on both ends already: a 5/2's return spring becomes an air pilot.
    if (nextCells === 3 && next.right === 'spring') next.right = 'air';
    // A newly chosen solenoid gets a coil name nobody else uses yet.
    for (const [side, key] of [
      ['left', 'key14'],
      ['right', 'key12'],
    ] as const) {
      if (next[side] === 'solenoid' && !next[key]) next[key] = nextFreeSolenoidKeys(1)[0] ?? 'Y1';
    }
    const type = nextCells === 3 ? VALVE_53_CONFIGURABLE_TYPE : VALVE_52_CONFIGURABLE_TYPE;
    const target = comp.type === type ? comp : swapComponentType(comp, type);
    if (!target) return;
    // An end with no air pilot has no pilot port, nor a valve without an external pilot port X.
    const gone: string[] = [];
    if (next.left !== 'air') gone.push('14');
    if (next.right !== 'air') gone.push('12');
    if (readPilotSupply(next) !== 'external') gone.push('X');
    unwire(target, gone);
    target.restore({ ...target.snapshot(), ...next });
    appState.markDirty();
  }

  const heading = document.createElement('div');
  heading.className = 'inspectorSectionHeading';
  heading.textContent = 'Actuation';
  container.appendChild(heading);

  const view = preview(comp, cells);
  if (view) container.appendChild(view);

  const ends = document.createElement('div');
  ends.className = 'valveConfigEnds';
  const leftOptions = cells === 3 ? END_ACTUATORS_53 : LEFT_ACTUATORS;
  const rightOptions = cells === 3 ? END_ACTUATORS_53 : RIGHT_ACTUATORS;
  ends.append(
    select(leftOptions, ACTUATOR_LABELS, left, 'Left end (14)', (v) => apply({ left: v })),
    select(rightOptions, ACTUATOR_LABELS, right, 'Right end (12)', (v) => apply({ right: v })),
  );
  container.appendChild(ends);

  container.appendChild(
    row(
      'Valve',
      select(
        ['2', '3'] as Array<'2' | '3'>,
        { '2': '5/2', '3': '5/3' },
        String(cells) as '2' | '3',
        'Valve',
        (v) => apply({}, v === '3' ? 3 : 2),
      ),
    ),
  );

  if (cells === 3) {
    const centre = (cfg.centre as Centre53) ?? 'closed';
    container.appendChild(
      row(
        'Centre',
        select(
          ['closed', 'exhaust', 'pressure'] as Centre53[],
          CENTRE_53_LABELS,
          centre,
          'Centre position',
          (v) => apply({ centre: v }),
        ),
      ),
    );
  }

  // What each end needs to know: a coil name, or which sensor its roller reads.
  const sensors = listAllSensorLabels();
  for (const [kind, keyField, sensorField, label] of [
    [left, 'key14', 'sensor14', 'Left'],
    [right, 'key12', 'sensor12', 'Right'],
  ] as const) {
    if (kind === 'solenoid') {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(cfg[keyField] ?? '');
      input.addEventListener('change', () => apply({ [keyField]: input.value.trim() }));
      container.appendChild(row(`${label} coil`, input));
    } else if (kind === 'roller') {
      const sel = document.createElement('select');
      sel.append(new Option('(none)', ''));
      for (const s of sensors) sel.append(new Option(`${s.label} (${s.cylinderName})`, s.label));
      const current = String(cfg[sensorField] ?? '');
      if (current && !sensors.some((s) => s.label.toUpperCase() === current.toUpperCase())) {
        sel.append(new Option(`${current} (not found)`, current));
      }
      sel.value = current;
      sel.addEventListener('change', () => apply({ [sensorField]: sel.value }));
      container.appendChild(row(`${label} roller sensor`, sel));
    }
  }

  container.appendChild(
    row(
      'Pilot',
      select(
        ['none', 'internal', 'external'] as PilotSupply[],
        PILOT_SUPPLY_LABELS,
        pilot,
        'Pilot stage',
        (v) => apply({ pilotSupply: v }),
      ),
    ),
  );

  if (cells === 2 && right !== 'spring') {
    const sel = document.createElement('select');
    sel.append(new Option('1→2 (right box)', '1'), new Option('1→4 (left box)', '0'));
    sel.value = cfg.startPos === 0 ? '0' : '1';
    sel.addEventListener('change', () => apply({ startPos: sel.value === '0' ? 0 : 1 }));
    container.appendChild(row('Starts in', sel));
  }
}
