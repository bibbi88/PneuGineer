import type { Component } from '../core/types';
import { getSelectedComponents, onSelectionChange } from '../interaction/selection';
import { redrawAllConnections } from '../wires/connection';
import { RESTRICTOR_TYPE } from '../components/restrictor';
import { ONE_WAY_FLOW_CONTROL_VALVE_TYPE } from '../components/oneWayFlowControlValve';
import { TIME_DELAY_VALVE_TYPE } from '../components/timeDelayValve';
import { LIMIT_VALVE_32_TYPE } from '../components/limitValve32';

interface InspectorField {
  key: string;
  label: string;
  kind: 'number' | 'text';
  min?: number;
  max?: number;
  step?: number;
}

const INSPECTOR_FIELDS: Record<string, InspectorField[]> = {
  [RESTRICTOR_TYPE]: [
    { key: 'flowPct', label: 'Flow %', kind: 'number', min: 0, max: 100, step: 5 },
  ],
  [ONE_WAY_FLOW_CONTROL_VALVE_TYPE]: [
    { key: 'flowPct', label: 'Reverse flow %', kind: 'number', min: 0, max: 100, step: 5 },
  ],
  [TIME_DELAY_VALVE_TYPE]: [
    { key: 'delaySec', label: 'Delay (s)', kind: 'number', min: 0, max: 30, step: 0.1 },
  ],
  [LIMIT_VALVE_32_TYPE]: [{ key: 'sensorKey', label: 'Sensor key', kind: 'text' }],
};

/** Uses each component's own snapshot()/restore() as an implicit get/set for one field,
 * so the inspector doesn't need a bespoke setter API per component type. */
function updateComponentField(comp: Component, key: string, value: unknown): void {
  comp.restore({ ...comp.snapshot(), [key]: value });
  redrawAllConnections();
}

export function renderInspector(container: HTMLElement): void {
  function refresh(): void {
    container.replaceChildren();

    const selected = getSelectedComponents();
    if (selected.length !== 1) return;
    const comp = selected[0] as Component;

    const fields = INSPECTOR_FIELDS[comp.type];
    if (!fields || fields.length === 0) return;

    const title = document.createElement('h3');
    title.textContent = 'Inspector';
    container.appendChild(title);

    const snap = comp.snapshot();
    for (const field of fields) {
      const row = document.createElement('label');
      row.className = 'inspectorRow';

      const span = document.createElement('span');
      span.textContent = field.label;

      const input = document.createElement('input');
      input.type = field.kind === 'number' ? 'number' : 'text';
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      input.value = String(snap[field.key] ?? '');

      input.addEventListener('change', () => {
        const value = field.kind === 'number' ? Number(input.value) : input.value;
        updateComponentField(comp, field.key, value);
      });

      row.append(span, input);
      container.appendChild(row);
    }
  }

  onSelectionChange(refresh);
  refresh();
}
