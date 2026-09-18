import type { Component } from '../core/types';
import type { ViewportAdapter } from './viewport';
import type { ProjectBarRefs } from './projectBar';
import { appState } from '../app/AppState';
import { getSelectedComponents, onSelectionChange } from '../interaction/selection';
import { redrawAllConnections } from '../wires/connection';
import { setGridEnabled } from '../core/grid';
import { loadGridPreference, saveGridPreference } from '../app/gridPreference';
import { setPageFrameSize, renderPageFrame, type PageFrameSize } from './pageFrame';
import { RESTRICTOR_TYPE } from '../components/restrictor';
import { ONE_WAY_FLOW_CONTROL_VALVE_TYPE } from '../components/oneWayFlowControlValve';
import { THROTTLE_VALVE_TYPE } from '../components/throttleValve';
import { QUICK_EXHAUST_VALVE_TYPE } from '../components/quickExhaustValve';
import { TIME_DELAY_VALVE_TYPE } from '../components/timeDelayValve';
import { LIMIT_VALVE_32_TYPE } from '../components/limitValve32';
import { PUSH_BUTTON_32_TYPE } from '../components/pushButton32';
import { AIR_VALVE_32_TYPE } from '../components/airValve32';
import { CYLINDER_DOUBLE_TYPE } from '../components/cylinderDouble';
import { CYLINDER_SINGLE_TYPE } from '../components/cylinderSingle';
import { VALVE_52_TYPE } from '../components/valve52';
import { VALVE_52_MONO_TYPE } from '../components/valve52Mono';
import {
  nextSensorLabel,
  isSensorLabelInUse,
  isSensorKeyBoundElsewhere,
  listAllSensorLabels,
  type CylinderSensor,
} from '../components/shared/sensorPositions';
import { swapComponentType } from '../interaction/valveActuatorSwap';
import { JUNCTION_TYPE } from '../components/junction';
import { TEXT_ANNOTATION_TYPE } from '../components/textAnnotation';

type FieldLabel = string | ((comp: Component) => string);

interface NumberField {
  kind: 'number';
  key: string;
  label: FieldLabel;
  min?: number;
  max?: number;
  step?: number;
}

interface TextField {
  kind: 'text';
  key: string;
  label: FieldLabel;
}

/** A plain boolean snapshot key/value, e.g. a cylinder's "show force" toggle. */
interface CheckboxField {
  kind: 'checkbox';
  key: string;
  label: FieldLabel;
}

/** A limit switch's sensor key, shown as a dropdown of every sensor label that actually exists
 * in the project rather than free text - binding becomes a choice, not something that can
 * silently typo-mismatch a cylinder's signal. */
interface SensorKeySelectField {
  kind: 'sensorKeySelect';
  key: string;
  label: FieldLabel;
}

/** An open-ended, addable/removable list of named ranges - currently only a cylinder's sensors,
 * each read/written as a whole array under `arrayKey` rather than one scalar key per field. */
interface SensorListField {
  kind: 'sensorList';
  arrayKey: string;
  min?: number;
  max?: number;
  step?: number;
}

/** A choice between whole component types (see interaction/valveActuatorSwap.ts's own doc for
 * why, e.g. push-button vs limit-switch vs air-piloted, or a 5/2 valve's bistable vs monostable
 * pilot), not a scalar snapshot field - shown as a dropdown that replaces the component in place
 * when changed, reconnecting every wire whose port exists on both. */
interface ActuatorModeField {
  kind: 'actuatorMode';
  label: string;
  options: Array<{ type: string; label: string }>;
}

/** A component's own identifying label (currently just a cylinder's letter), renamed through
 * `comp.renameLabel()` rather than a plain snapshot key/value - that's what cascades the rename
 * into the cylinder's sensor labels and anything bound to them. */
interface RelabelField {
  kind: 'relabel';
  label: FieldLabel;
}

/** A single-acting cylinder's push/pull mode, switched through `comp.setCylinderMode()` rather
 * than a plain snapshot key/value - that's what snaps the piston straight to the new mode's own
 * default rest position instead of just changing which end pressurizing port A extends toward. */
interface CylinderModeField {
  kind: 'cylinderMode';
}

/** Whether a muffler symbol is attached directly to one of this valve's exhaust ports - a plain
 * snapshot key/value like `number`/`text`, just rendered as a None/Silencer dropdown instead of
 * a free-form input. `port` is the actual port key this attaches to (e.g. "3"), checked against
 * live wiring before a silencer is allowed on - a port already carrying a wire can't also take
 * one, since the two occupy the same physical connection point. */
interface SilencerField {
  kind: 'silencer';
  key: string;
  port: string;
  label: FieldLabel;
}

type InspectorField =
  | NumberField
  | TextField
  | CheckboxField
  | SensorListField
  | ActuatorModeField
  | SensorKeySelectField
  | RelabelField
  | CylinderModeField
  | SilencerField;

const ACTUATOR_MODES: Array<{ type: string; label: string }> = [
  { type: PUSH_BUTTON_32_TYPE, label: 'Push button' },
  { type: LIMIT_VALVE_32_TYPE, label: 'Limit switch' },
  { type: AIR_VALVE_32_TYPE, label: 'Air-piloted' },
];

const VALVE_52_MODES: Array<{ type: string; label: string }> = [
  { type: VALVE_52_TYPE, label: 'Bistable (double pilot)' },
  { type: VALVE_52_MONO_TYPE, label: 'Monostable (spring return)' },
];

const INSPECTOR_FIELDS: Record<string, InspectorField[]> = {
  [RESTRICTOR_TYPE]: [
    { kind: 'number', key: 'flowPct', label: 'Flow %', min: 0, max: 100, step: 5 },
  ],
  [ONE_WAY_FLOW_CONTROL_VALVE_TYPE]: [
    { kind: 'number', key: 'flowPct', label: 'Reverse flow %', min: 0, max: 100, step: 5 },
  ],
  [THROTTLE_VALVE_TYPE]: [
    { kind: 'number', key: 'flowPct', label: 'Flow %', min: 0, max: 100, step: 5 },
  ],
  [QUICK_EXHAUST_VALVE_TYPE]: [
    { kind: 'checkbox', key: 'showPortNumbers', label: 'Show port numbers' },
  ],
  [TIME_DELAY_VALVE_TYPE]: [
    { kind: 'number', key: 'delaySec', label: 'Delay (s)', min: 0, max: 30, step: 0.1 },
    { kind: 'silencer', key: 'silencer3', port: '3', label: 'Port 3 silencer' },
  ],
  [PUSH_BUTTON_32_TYPE]: [
    { kind: 'actuatorMode', label: 'Control mode', options: ACTUATOR_MODES },
    { kind: 'silencer', key: 'silencer3', port: '3', label: 'Port 3 silencer' },
  ],
  [LIMIT_VALVE_32_TYPE]: [
    { kind: 'actuatorMode', label: 'Control mode', options: ACTUATOR_MODES },
    { kind: 'sensorKeySelect', key: 'sensorKey', label: 'Sensor key' },
    { kind: 'silencer', key: 'silencer3', port: '3', label: 'Port 3 silencer' },
  ],
  [AIR_VALVE_32_TYPE]: [
    { kind: 'actuatorMode', label: 'Control mode', options: ACTUATOR_MODES },
    { kind: 'silencer', key: 'silencer3', port: '3', label: 'Port 3 silencer' },
  ],
  [VALVE_52_TYPE]: [
    { kind: 'actuatorMode', label: 'Pilot', options: VALVE_52_MODES },
    { kind: 'silencer', key: 'silencer3', port: '3', label: 'Port 3 silencer' },
    { kind: 'silencer', key: 'silencer5', port: '5', label: 'Port 5 silencer' },
  ],
  [VALVE_52_MONO_TYPE]: [
    { kind: 'actuatorMode', label: 'Pilot', options: VALVE_52_MODES },
    { kind: 'silencer', key: 'silencer3', port: '3', label: 'Port 3 silencer' },
    { kind: 'silencer', key: 'silencer5', port: '5', label: 'Port 5 silencer' },
  ],
  [CYLINDER_DOUBLE_TYPE]: [
    { kind: 'relabel', label: 'Cylinder letter' },
    { kind: 'number', key: 'boreDiameter', label: 'Bore diameter (mm)', min: 1, max: 500, step: 1 },
    { kind: 'number', key: 'rodDiameter', label: 'Rod diameter (mm)', min: 1, max: 500, step: 1 },
    { kind: 'checkbox', key: 'showForce', label: 'Show force' },
    { kind: 'sensorList', arrayKey: 'sensors', min: 0, max: 100, step: 1 },
  ],
  [CYLINDER_SINGLE_TYPE]: [
    { kind: 'relabel', label: 'Cylinder letter' },
    { kind: 'cylinderMode' },
    { kind: 'number', key: 'boreDiameter', label: 'Bore diameter (mm)', min: 1, max: 500, step: 1 },
    { kind: 'number', key: 'rodDiameter', label: 'Rod diameter (mm)', min: 1, max: 500, step: 1 },
    { kind: 'checkbox', key: 'showForce', label: 'Show force' },
    { kind: 'sensorList', arrayKey: 'sensors', min: 0, max: 100, step: 1 },
  ],
  [TEXT_ANNOTATION_TYPE]: [{ kind: 'text', key: 'text', label: 'Text' }],
};

function resolveLabel(label: FieldLabel, comp: Component): string {
  return typeof label === 'function' ? label(comp) : label;
}

/** Uses each component's own snapshot()/restore() as an implicit get/set for one field,
 * so the inspector doesn't need a bespoke setter API per component type. markDirty() is what
 * makes the edit undo-able and autosaved (same as any other project change) - it also fires
 * appState's onChange, which is what lets a limit switch notice when some *other* one's sensor
 * key changed and recheck whether it now shares a label with it. */
function updateComponentField(comp: Component, key: string, value: unknown): void {
  comp.restore({ ...comp.snapshot(), [key]: value });
  redrawAllConnections();
  appState.markDirty();
}

function renderNumberOrTextField(
  container: HTMLElement,
  comp: Component,
  field: NumberField | TextField,
  snap: Record<string, unknown>,
): void {
  const row = document.createElement('label');
  row.className = 'inspectorRow';

  const span = document.createElement('span');
  span.textContent = resolveLabel(field.label, comp);

  const input = document.createElement('input');
  input.type = field.kind === 'number' ? 'number' : 'text';
  if (field.kind === 'number') {
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.step !== undefined) input.step = String(field.step);
  }
  input.value = String(snap[field.key] ?? '');

  input.addEventListener('change', () => {
    const value = field.kind === 'number' ? Number(input.value) : input.value;
    updateComponentField(comp, field.key, value);
  });

  row.append(span, input);
  container.appendChild(row);
}

function renderCheckboxField(
  container: HTMLElement,
  comp: Component,
  field: CheckboxField,
  snap: Record<string, unknown>,
): void {
  const row = document.createElement('label');
  row.className = 'inspectorRow';

  const span = document.createElement('span');
  span.textContent = resolveLabel(field.label, comp);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(snap[field.key]);
  checkbox.addEventListener('change', () => {
    updateComponentField(comp, field.key, checkbox.checked);
  });

  row.append(span, checkbox);
  container.appendChild(row);
}

function renderActuatorModeField(
  container: HTMLElement,
  comp: Component,
  field: ActuatorModeField,
): void {
  const row = document.createElement('label');
  row.className = 'inspectorRow';

  const span = document.createElement('span');
  span.textContent = field.label;

  const select = document.createElement('select');
  for (const mode of field.options) {
    const option = document.createElement('option');
    option.value = mode.type;
    option.textContent = mode.label;
    select.appendChild(option);
  }
  select.value = comp.type;

  select.addEventListener('change', () => {
    if (select.value !== comp.type) swapComponentType(comp, select.value);
    // swapComponentType replaces the component and re-selects the new one, which triggers
    // onSelectionChange -> refresh() on its own - nothing more to do here.
  });

  row.append(span, select);
  container.appendChild(row);
}

const CYLINDER_MODES: Array<{ value: 'push' | 'pull'; label: string }> = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
];

function renderCylinderModeField(
  container: HTMLElement,
  comp: Component,
  onChange: () => void,
): void {
  const row = document.createElement('label');
  row.className = 'inspectorRow';

  const span = document.createElement('span');
  span.textContent = 'Mode';

  const select = document.createElement('select');
  for (const m of CYLINDER_MODES) {
    const option = document.createElement('option');
    option.value = m.value;
    option.textContent = m.label;
    select.appendChild(option);
  }
  select.value = (comp.snapshot() as Record<string, unknown>).mode as string;

  select.addEventListener('change', () => {
    comp.setCylinderMode?.(select.value as 'push' | 'pull');
    onChange();
  });

  row.append(span, select);
  container.appendChild(row);
}

const SILENCER_OPTIONS: Array<{ value: 'none' | 'silencer'; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'silencer', label: 'Silencer' },
];

function isPortWired(compId: number, port: string): boolean {
  return appState.connections.some(
    (c) =>
      (c.from.id === compId && c.from.port === port) || (c.to.id === compId && c.to.port === port),
  );
}

function renderSilencerField(
  container: HTMLElement,
  comp: Component,
  field: SilencerField,
  snap: Record<string, unknown>,
): void {
  const row = document.createElement('label');
  row.className = 'inspectorRow';

  const span = document.createElement('span');
  span.textContent = resolveLabel(field.label, comp);

  const select = document.createElement('select');
  for (const opt of SILENCER_OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  }
  const current = (snap[field.key] as string) ?? 'none';
  select.value = current;

  select.addEventListener('change', () => {
    // A wired port is already physically occupied - a silencer can't also go there. Attaching a
    // wire to an already-silenced port is separately blocked at the port itself (see
    // shared/silencer.ts's setSilencerState, which disables the port while a silencer is on).
    if (select.value === 'silencer' && isPortWired(comp.id, field.port)) {
      flashRejected(select, current);
      return;
    }
    updateComponentField(comp, field.key, select.value);
  });

  row.append(span, select);
  container.appendChild(row);
}

function renderSensorKeySelectField(
  container: HTMLElement,
  comp: Component,
  field: SensorKeySelectField,
  snap: Record<string, unknown>,
  onChange: () => void,
): void {
  const row = document.createElement('label');
  row.className = 'inspectorRow';

  const span = document.createElement('span');
  span.textContent = resolveLabel(field.label, comp);

  const select = document.createElement('select');
  const current = String(snap[field.key] ?? '');
  const options = listAllSensorLabels();

  // Always available, including alongside a real binding - unbinding one switch is how a label
  // gets freed up to swap with another's without having to move either off to the side first:
  // clear one switch's label, give its now-free label to the other, then give the first switch
  // what the other just gave up.
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '(none)';
  select.appendChild(noneOpt);

  // The current binding stays selectable even if it doesn't match any sensor that exists right
  // now (its cylinder was deleted, or this was typed in before the field became a dropdown) -
  // switching it away is a deliberate choice, not something losing the value should force.
  const currentExists = options.some((o) => o.label.toUpperCase() === current.toUpperCase());
  if (current && !currentExists) {
    const opt = document.createElement('option');
    opt.value = current;
    opt.textContent = `${current} (not found)`;
    select.appendChild(opt);
  }
  // A label already used by another limit switch stays selectable - two switches can
  // legitimately react to the same sensor (a real circuit might fan one signal out to several
  // valves) - just marked, so picking one is an informed choice rather than a surprise.
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.label;
    const takenElsewhere =
      o.label.toUpperCase() !== current.toUpperCase() &&
      isSensorKeyBoundElsewhere(o.label, comp.id);
    opt.textContent = takenElsewhere
      ? `${o.label} — ${o.cylinderName} (also used)`
      : `${o.label} — ${o.cylinderName}`;
    select.appendChild(opt);
  }
  select.value = current;

  select.addEventListener('change', () => {
    updateComponentField(comp, field.key, select.value);
    // Whether this switch (now) duplicates another, and whether any *other* option should read
    // "(also used)", both depend on the value just picked - re-render so the warning and the
    // rest of the list reflect it immediately instead of only on the next selection change.
    onChange();
  });

  row.append(span, select);
  container.appendChild(row);

  // The symbol's own sensor-key text also turns red for this (see limitValve32.ts) - this is
  // the same check surfaced in the inspector, in case the symbol isn't currently in view.
  if (current && isSensorKeyBoundElsewhere(current, comp.id)) {
    const warning = document.createElement('p');
    warning.className = 'inspectorWarning';
    warning.textContent = `Another limit switch is also bound to "${current}".`;
    container.appendChild(warning);
  }
}

/** Briefly flags `input` as rejected (a duplicate label, or some other invalid value) without a
 * popup - just a red outline that clears itself, plus reverting the value the user tried to
 * commit. */
function flashRejected(input: HTMLInputElement | HTMLSelectElement, revertTo: string): void {
  input.value = revertTo;
  input.classList.add('inspectorFieldError');
  window.setTimeout(() => input.classList.remove('inspectorFieldError'), 1000);
}

function renderRelabelField(
  container: HTMLElement,
  comp: Component,
  field: RelabelField,
  onChange: () => void,
): void {
  const row = document.createElement('label');
  row.className = 'inspectorRow';

  const span = document.createElement('span');
  span.textContent = resolveLabel(field.label, comp);

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 1;
  const current = String(comp.snapshot().letter ?? '');
  input.value = current;

  input.addEventListener('change', () => {
    if (!comp.renameLabel?.(input.value)) {
      flashRejected(input, current);
      return;
    }
    // A rename cascades into the sensor list's labels (and possibly other components' sensor
    // key bindings) - re-render so this panel's own sensor rows pick up their new names right
    // away instead of only on the next selection change.
    onChange();
  });

  row.append(span, input);
  container.appendChild(row);
}

/** Renders the sensor list as its own section (explanation, one row per sensor with a live
 * slider, an Add button) and re-renders `onChange` after every add/remove, since the row count
 * itself can change. */
function renderSensorListField(
  container: HTMLElement,
  comp: Component,
  field: SensorListField,
  snap: Record<string, unknown>,
  onChange: () => void,
): void {
  const sensors = (snap[field.arrayKey] as CylinderSensor[] | undefined) ?? [];
  const lo = field.min ?? 0;
  const hi = field.max ?? 100;

  const heading = document.createElement('div');
  heading.className = 'inspectorSectionHeading';
  heading.textContent = 'Sensors';
  container.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'inspectorHint';
  hint.textContent =
    'Each sensor turns on while the piston is within its range of the stroke (0% = fully ' +
    'retracted, 100% = fully extended). Give a 3/2 limit switch the same label as its "Sensor ' +
    'key" to read it - labels are case-insensitive, so "a0" and "A0" are the same sensor.';
  container.appendChild(hint);

  function writeSensors(next: CylinderSensor[]): void {
    updateComponentField(comp, field.arrayKey, next);
    onChange();
  }

  sensors.forEach((sensor, index) => {
    const row = document.createElement('div');
    row.className = 'inspectorSensorRow';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'inspectorSensorLabel';
    labelInput.value = sensor.label;
    labelInput.addEventListener('change', () => {
      const next = labelInput.value.trim();
      if (!next) {
        labelInput.value = sensor.label;
        return;
      }
      if (isSensorLabelInUse(next, { compId: comp.id, index })) {
        flashRejected(labelInput, sensor.label);
        return;
      }
      const updated = sensors.slice();
      updated[index] = { ...sensor, label: next };
      writeSensors(updated);
    });

    const fromInput = document.createElement('input');
    fromInput.type = 'number';
    const toInput = document.createElement('input');
    toInput.type = 'number';
    for (const el of [fromInput, toInput]) {
      el.min = String(lo);
      el.max = String(hi);
      if (field.step !== undefined) el.step = String(field.step);
    }
    fromInput.value = String(sensor.minPct);
    toInput.value = String(sensor.maxPct);

    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'sensorSlider';
    const track = document.createElement('div');
    track.className = 'sensorSliderTrack';
    const fill = document.createElement('div');
    fill.className = 'sensorSliderRange';
    const minSlider = document.createElement('input');
    minSlider.type = 'range';
    minSlider.className = 'sensorSliderInput';
    const maxSlider = document.createElement('input');
    maxSlider.type = 'range';
    maxSlider.className = 'sensorSliderInput';
    for (const el of [minSlider, maxSlider]) {
      el.min = String(lo);
      el.max = String(hi);
      el.step = String(field.step ?? 1);
    }
    minSlider.value = String(sensor.minPct);
    maxSlider.value = String(sensor.maxPct);
    sliderWrap.append(track, fill, minSlider, maxSlider);

    function positionFill(minPct: number, maxPct: number): void {
      const span = hi - lo || 1;
      fill.style.left = `${((minPct - lo) / span) * 100}%`;
      fill.style.width = `${((maxPct - minPct) / span) * 100}%`;
    }
    positionFill(sensor.minPct, sensor.maxPct);

    function commitRange(minPct: number, maxPct: number): void {
      fromInput.value = String(minPct);
      toInput.value = String(maxPct);
      minSlider.value = String(minPct);
      maxSlider.value = String(maxPct);
      positionFill(minPct, maxPct);
      const updated = sensors.slice();
      updated[index] = { ...sensor, minPct, maxPct };
      writeSensors(updated);
    }

    fromInput.addEventListener('change', () => {
      const clamped = Math.min(Math.max(Number(fromInput.value), lo), hi);
      commitRange(clamped, Math.max(clamped, Number(toInput.value)));
    });
    toInput.addEventListener('change', () => {
      const clamped = Math.min(Math.max(Number(toInput.value), lo), hi);
      commitRange(Math.min(clamped, Number(fromInput.value)), clamped);
    });
    minSlider.addEventListener('input', () => {
      const v = Math.min(Number(minSlider.value), Number(maxSlider.value));
      minSlider.value = String(v);
      positionFill(v, Number(maxSlider.value));
    });
    minSlider.addEventListener('change', () => {
      commitRange(
        Number(minSlider.value),
        Math.max(Number(minSlider.value), Number(maxSlider.value)),
      );
    });
    maxSlider.addEventListener('input', () => {
      const v = Math.max(Number(maxSlider.value), Number(minSlider.value));
      maxSlider.value = String(v);
      positionFill(Number(minSlider.value), v);
    });
    maxSlider.addEventListener('change', () => {
      commitRange(
        Math.min(Number(minSlider.value), Number(maxSlider.value)),
        Number(maxSlider.value),
      );
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'inspectorRemoveBtn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove sensor';
    removeBtn.addEventListener('click', () => {
      writeSensors(sensors.filter((_, i) => i !== index));
    });

    const numbersRow = document.createElement('div');
    numbersRow.className = 'inspectorSensorNumbers';
    const sep = document.createElement('span');
    sep.className = 'inspectorRangeSep';
    sep.textContent = '–';
    numbersRow.append(labelInput, fromInput, sep, toInput, removeBtn);

    row.append(numbersRow, sliderWrap);
    container.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn inspectorAddBtn';
  addBtn.textContent = '+ Add sensor';
  addBtn.addEventListener('click', () => {
    const letter = String(comp.snapshot().letter ?? '');
    const label = nextSensorLabel(letter);
    writeSensors([...sensors, { label, minPct: 45, maxPct: 55 }]);
  });
  container.appendChild(addBtn);
}

/** Types with no meaningful identifying name to show/hide/override - a wire junction only ever
 * exists as a side effect of splitting a wire, and a text annotation's own text already serves
 * that purpose, so neither gets the generic name section below. */
const NO_NAME_SECTION = new Set([JUNCTION_TYPE, TEXT_ANNOTATION_TYPE]);

/** Every component gets this, regardless of type: names are hidden by default (see
 * svgHelpers.ts) since a diagram with every symbol labeled gets noisy fast, but showing one
 * (and optionally overriding it with a custom name, e.g. "Clamp cylinder" instead of
 * "Cylinder A") is one checkbox + one text field away. */
function renderNameSection(
  container: HTMLElement,
  comp: Component,
  snap: Record<string, unknown>,
): void {
  const heading = document.createElement('div');
  heading.className = 'inspectorSectionHeading';
  heading.textContent = 'Name';
  container.appendChild(heading);

  const showRow = document.createElement('label');
  showRow.className = 'inspectorRow';
  const showSpan = document.createElement('span');
  showSpan.textContent = 'Show name in diagram';
  const showCheckbox = document.createElement('input');
  showCheckbox.type = 'checkbox';
  showCheckbox.checked = Boolean(snap.showName);
  showCheckbox.addEventListener('change', () => {
    updateComponentField(comp, 'showName', showCheckbox.checked);
  });
  showRow.append(showSpan, showCheckbox);
  container.appendChild(showRow);

  const nameRow = document.createElement('label');
  nameRow.className = 'inspectorRow';
  const nameSpan = document.createElement('span');
  nameSpan.textContent = 'Custom name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'inspectorCustomNameInput';
  nameInput.placeholder = '(default)';
  nameInput.value = (snap.customName as string | null) ?? '';
  nameInput.addEventListener('change', () => {
    updateComponentField(comp, 'customName', nameInput.value.trim() || null);
  });
  nameRow.append(nameSpan, nameInput);
  container.appendChild(nameRow);
}

const PAGE_FRAME_OPTIONS: Array<{ value: PageFrameSize; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'a4', label: 'A4' },
  { value: 'a3', label: 'A3' },
];

/** Title-block metadata - project name, author, checked by, company - plus the page-frame size
 * picker, shown only while nothing is selected, same as Grid below. Project name mirrors the
 * sidebar's own name field (writes through `projectBar.setName` so both stay in sync); the rest
 * live only on `appState` and round-trip through the project file (see persistence/project.ts)
 * alongside it. Every field here also appears in the page frame's own title block (see
 * ui/pageFrame.ts), which is why each commit re-renders that too, not just this panel. */
function renderProjectInfoSection(container: HTMLElement, projectBar: ProjectBarRefs): void {
  const heading = document.createElement('div');
  heading.className = 'inspectorSectionHeading';
  heading.textContent = 'Project info';
  container.appendChild(heading);

  function fieldRow(
    label: string,
    type: 'text' | 'date',
    value: string,
    onCommit: (v: string) => void,
  ): void {
    const row = document.createElement('label');
    row.className = 'inspectorRow';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.className = 'inspectorCustomNameInput';
    input.value = value;
    input.addEventListener('change', () => {
      onCommit(input.value);
      renderPageFrame();
    });
    row.append(span, input);
    container.appendChild(row);
  }

  fieldRow('Project name', 'text', projectBar.getName(), (v) => projectBar.setName(v));
  fieldRow('Date', 'date', appState.projectDate, (v) => {
    appState.projectDate = v;
  });
  fieldRow('Author', 'text', appState.projectAuthor, (v) => {
    appState.projectAuthor = v;
  });
  fieldRow('Checked by', 'text', appState.projectCheckedBy, (v) => {
    appState.projectCheckedBy = v;
  });
  fieldRow('Company', 'text', appState.projectCompany, (v) => {
    appState.projectCompany = v;
  });

  const frameRow = document.createElement('label');
  frameRow.className = 'inspectorRow';
  const frameSpan = document.createElement('span');
  frameSpan.textContent = 'Page frame';
  const frameSelect = document.createElement('select');
  for (const opt of PAGE_FRAME_OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    frameSelect.appendChild(option);
  }
  frameSelect.value = appState.pageFrameSize;
  frameSelect.addEventListener('change', () => {
    setPageFrameSize(frameSelect.value as PageFrameSize);
  });
  frameRow.append(frameSpan, frameSelect);
  container.appendChild(frameRow);

  const frameHint = document.createElement('p');
  frameHint.className = 'inspectorHint';
  frameHint.textContent =
    'Draws a sheet outline with the fields above as a title block - a visual guide only, ' +
    'centered on the current diagram when picked.';
  container.appendChild(frameHint);
}

/** A workspace-wide preference, not tied to any component, so it renders unconditionally -
 * unlike everything else in this panel, it stays visible with nothing (or several things)
 * selected. Turns off both the visual grid and snap-to-grid together, since a hidden grid a
 * component still silently snaps to is a worse experience than either fully on or fully off. */
function renderGridSection(container: HTMLElement, viewport: ViewportAdapter): void {
  const heading = document.createElement('div');
  heading.className = 'inspectorSectionHeading';
  heading.textContent = 'Grid';
  container.appendChild(heading);

  const row = document.createElement('label');
  row.className = 'inspectorRow';
  const span = document.createElement('span');
  span.textContent = 'Show grid';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = loadGridPreference();
  checkbox.addEventListener('change', () => {
    setGridEnabled(checkbox.checked);
    viewport.setGridVisible(checkbox.checked);
    saveGridPreference(checkbox.checked);
  });
  row.append(span, checkbox);
  container.appendChild(row);
}

export function renderInspector(
  container: HTMLElement,
  viewport: ViewportAdapter,
  projectBar: ProjectBarRefs,
): void {
  function refresh(): void {
    container.replaceChildren();

    const selected = getSelectedComponents();
    if (selected.length !== 1) {
      // Project info and the grid are workspace-wide settings, not component ones - but they
      // only get their own section here while nothing is selected, so they don't compete for
      // space with (or look like part of) whatever's actually being edited.
      if (selected.length === 0) {
        renderProjectInfoSection(container, projectBar);
        renderGridSection(container, viewport);
      }

      const hint = document.createElement('p');
      hint.className = 'inspectorHint';
      hint.textContent =
        selected.length === 0
          ? 'Select a component to edit its properties.'
          : 'Select a single component to edit its properties.';
      container.appendChild(hint);
      return;
    }
    const comp = selected[0] as Component;
    const snap = comp.snapshot() as Record<string, unknown>;

    const showsNameSection = !NO_NAME_SECTION.has(comp.type);
    if (showsNameSection) renderNameSection(container, comp, snap);

    const fields = INSPECTOR_FIELDS[comp.type];
    if (!fields || fields.length === 0) {
      if (!showsNameSection) {
        const hint = document.createElement('p');
        hint.className = 'inspectorHint';
        hint.textContent = 'This component has nothing to configure here.';
        container.appendChild(hint);
      }
      return;
    }

    for (const field of fields) {
      if (field.kind === 'sensorList') renderSensorListField(container, comp, field, snap, refresh);
      else if (field.kind === 'actuatorMode') renderActuatorModeField(container, comp, field);
      else if (field.kind === 'sensorKeySelect')
        renderSensorKeySelectField(container, comp, field, snap, refresh);
      else if (field.kind === 'relabel') renderRelabelField(container, comp, field, refresh);
      else if (field.kind === 'cylinderMode') renderCylinderModeField(container, comp, refresh);
      else if (field.kind === 'silencer') renderSilencerField(container, comp, field, snap);
      else if (field.kind === 'checkbox') renderCheckboxField(container, comp, field, snap);
      else renderNumberOrTextField(container, comp, field, snap);
    }
  }

  onSelectionChange(refresh);
  refresh();
}
