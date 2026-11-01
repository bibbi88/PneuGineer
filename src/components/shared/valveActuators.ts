import type { ConductivityContext, PortDef } from '../../core/types';
import { createLabeledPort, createSvgEl } from './svgHelpers';
import { addSpringZigzag, SPRING_DEFAULT_GEOMETRY } from './spring';
import { drawSolenoid, markDuplicateLabel } from '../solenoidValves';
import { getSignal } from '../../sim/signals';
import { flowPressureAt } from '../../sim/flowNetwork';
import { portKey } from '../../sim/pressure';
import { PILOT_MIN_BAR } from '../../sim/engine';
import { appState } from '../../app/AppState';

/** What shifts a configurable valve from one end: an air pilot (port 14/12), a solenoid (a coil
 * name, Y1...), a manual push button, a roller (a cylinder sensor, a0...) - or, on the right of
 * a 5/2 valve, a return spring. */
export type Actuator = 'air' | 'solenoid' | 'button' | 'roller' | 'spring';

/** Where a pilot-operated valve takes the air that drives its spool: not pilot-operated, from its
 * own port 1 (internal pilot), or from a separate pilot supply port X (external pilot). */
export type PilotSupply = 'none' | 'internal' | 'external';

export const ACTUATOR_LABELS: Record<Actuator, string> = {
  air: 'Air pilot',
  solenoid: 'Solenoid',
  button: 'Push button',
  roller: 'Roller',
  spring: 'Spring',
};

export const PILOT_SUPPLY_LABELS: Record<PilotSupply, string> = {
  none: 'Direct',
  internal: 'Internal pilot (1)',
  external: 'External pilot (X)',
};

/** Any actuated end can work through a pilot stage - only a spring can't. */
export function canBePilotOperated(a: Actuator): boolean {
  return a !== 'spring';
}

export function isActuator(v: unknown, allowed: Actuator[]): v is Actuator {
  return typeof v === 'string' && (allowed as string[]).includes(v);
}

/** Reads `pilotSupply`, also from projects saved with the earlier on/off `pilotOperated`. */
export function readPilotSupply(data: Record<string, unknown>): PilotSupply {
  if (data.pilotSupply === 'internal' || data.pilotSupply === 'external') return data.pilotSupply;
  if (data.pilotSupply === undefined && data.pilotOperated === true) return 'internal';
  return 'none';
}

const STROKE = 2;
/** The pilot stage's box on the end face, and the air pilot's triangle. */
const PILOT_BOX_W = 16;
const TRI_W = 18;
const TRI_H = 15;

function line(x1: number, y1: number, x2: number, y2: number, w = STROKE): SVGElement {
  return createSvgEl('line', { x1, y1, x2, y2, stroke: '#111', 'stroke-width': w });
}

export interface EndDrawing {
  /** The end face of the valve body this actuator acts on. */
  edgeX: number;
  /** Height of the actuator's centreline. */
  cy: number;
  /** For an air pilot: where its port sits, which the pilot line runs out to. */
  portX?: number;
  /** For an external pilot: how far down the dashed pilot line runs (the body's bottom edge). */
  bodyBottom?: number;
  /** Put a coil's or sensor's name under the actuator - on a 5/3, whose centring spring takes
   * the room above it. */
  labelBelow?: boolean;
}

/**
 * Draws one end's actuator into `group` (cleared first), with the pilot stage in front of it
 * when pilot-operated: a small box on the end face holding a filled triangle (ISO 1219-1), and
 * for an external pilot a dashed pilot line from it down to the body's bottom edge, where port
 * X takes it on. An air pilot is drawn as its triangle and the line out to its port; the port
 * itself belongs to the caller. A solenoid or roller carries `label` (its coil or sensor).
 */
export function drawActuator(
  group: SVGGElement,
  side: 'left' | 'right',
  kind: Actuator,
  label: string,
  pilot: PilotSupply,
  at: EndDrawing,
): void {
  group.replaceChildren();
  const dir = side === 'left' ? -1 : 1;
  const { cy } = at;
  let edge = at.edgeX;

  if (kind === 'spring') {
    addSpringZigzag(
      group,
      edge,
      edge + dir * SPRING_DEFAULT_GEOMETRY.springSpan,
      cy,
      STROKE,
      SPRING_DEFAULT_GEOMETRY,
    );
    return;
  }

  if (pilot !== 'none') {
    const x0 = Math.min(edge, edge + dir * PILOT_BOX_W);
    group.append(
      createSvgEl('rect', {
        x: x0,
        y: cy - 9,
        width: PILOT_BOX_W,
        height: 18,
        fill: '#fff',
        stroke: '#111',
        'stroke-width': STROKE,
      }),
      createSvgEl('polygon', {
        points: [
          [edge + dir * 3, cy],
          [edge + dir * 12, cy - 5],
          [edge + dir * 12, cy + 5],
        ]
          .map((p) => p.join(','))
          .join(' '),
        fill: '#111',
      }),
    );
    if (pilot === 'external' && at.bodyBottom !== undefined) {
      const lx = edge + dir * (PILOT_BOX_W / 2);
      group.appendChild(
        createSvgEl('line', {
          x1: lx,
          y1: cy + 9,
          x2: lx,
          y2: at.bodyBottom,
          stroke: '#111',
          'stroke-width': 1.5,
          'stroke-dasharray': '4 3',
        }),
      );
    }
    edge += dir * PILOT_BOX_W;
  }

  if (kind === 'air') {
    // Triangle, apex on the end face, then the pilot line out to the port.
    const base = edge + dir * TRI_W;
    group.append(
      createSvgEl('polygon', {
        points: [
          [edge, cy],
          [base, cy - TRI_H / 2],
          [base, cy + TRI_H / 2],
        ]
          .map((p) => p.join(','))
          .join(' '),
        fill: 'none',
        stroke: '#111',
        'stroke-width': STROKE,
      }),
    );
    if (at.portX !== undefined) group.appendChild(line(base, cy, at.portX, cy));
    return;
  }

  if (kind === 'solenoid') {
    const sub = createSvgEl('g');
    group.appendChild(sub);
    const text = drawSolenoid(sub, side, edge, cy, at.labelBelow ? 'below' : 'above');
    text.textContent = label;
    markDuplicateLabel(text, label);
    return;
  }

  if (kind === 'button') {
    // A plunger with a mushroom head.
    const out = edge + dir * 16;
    group.append(
      line(edge, cy, out, cy),
      line(out, cy - 10, out, cy + 10, 2.5),
      createSvgEl('path', {
        d: `M ${out} ${cy - 10} q ${dir * 7} 10 0 20`,
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
    line(edge, cy - 6, rx, cy - 6),
    line(edge, cy + 6, rx, cy + 6),
    createSvgEl('circle', {
      cx: rx + dir * 4,
      cy,
      r: 10,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': STROKE,
    }),
    createSvgEl('circle', {
      cx: rx + dir * 4,
      cy,
      r: 4,
      fill: '#fff',
      stroke: '#111',
      'stroke-width': STROKE,
    }),
  );
  const text = createSvgEl('text', {
    x: rx + dir * 4,
    y: at.labelBelow ? cy + 24 : cy - 15,
    'text-anchor': 'middle',
    'font-size': 11,
  });
  text.textContent = label;
  group.appendChild(text);
}

/**
 * The external pilot supply port X, fixed under the body's left end, with a short dashed lead up
 * to the body - drawn into `svg`; the returned group is shown only while the valve has an
 * external pilot.
 */
export function createPilotSupplyPort(
  svg: SVGSVGElement,
  x: number,
  bodyBottomY: number,
  portY: number,
): { group: SVGGElement; port: PortDef } {
  const group = createSvgEl('g');
  group.appendChild(
    createSvgEl('line', {
      x1: x,
      y1: bodyBottomY,
      x2: x,
      y2: portY,
      stroke: '#111',
      'stroke-width': 1.5,
      'stroke-dasharray': '4 3',
    }),
  );
  svg.appendChild(group);
  const port = createLabeledPort(group, 'X', x, portY, 'V', 'left');
  return { group, port };
}

/** What the valve's ends are, and the names and states they go by - for `isEndActuated`. */
export interface EndState {
  kind: Actuator;
  /** The air pilot's port key, '14' or '12'. */
  pilotPort: string;
  coil: string;
  sensor: string;
  pressed: boolean;
}

/** Whether the pilot stage of `compId` has the air it needs: at port 1 (internal) or X
 * (external) - at least PILOT_MIN_BAR in flow mode, pressurized in logic mode. */
export function hasPilotAir(compId: number, pilot: PilotSupply, ctx: ConductivityContext): boolean {
  if (pilot === 'none') return true;
  const port = pilot === 'external' ? 'X' : '1';
  if (appState.simulationMode === 'flow') {
    return (flowPressureAt(portKey(compId, port)) ?? 0) >= PILOT_MIN_BAR;
  }
  return ctx.isPressurized(port);
}

/** Whether one end is actuated this instant: its air pilot pressurized, its coil energized, its
 * button held, its roller's sensor on - and, if pilot-operated, with pilot air to act on. */
export function isEndActuated(
  compId: number,
  end: EndState,
  pilot: PilotSupply,
  ctx: ConductivityContext,
): boolean {
  let on = false;
  if (end.kind === 'air') on = ctx.isPressurized(end.pilotPort);
  else if (end.kind === 'solenoid') on = end.coil ? getSignal(end.coil) : false;
  else if (end.kind === 'button') on = end.pressed;
  else if (end.kind === 'roller') on = end.sensor ? getSignal(end.sensor) : false;
  if (on && canBePilotOperated(end.kind)) on = hasPilotAir(compId, pilot, ctx);
  return on;
}
