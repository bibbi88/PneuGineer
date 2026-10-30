import { createSvgEl } from './svgHelpers';
import { isSensorLabelBound, type CylinderSensor } from './sensorPositions';

/**
 * A cylinder's sensor marks, as circuit diagrams draw them: for each sensor something actually
 * reads (a limit valve or contact bound to a0, a1...), a short tick where the rod end trips it,
 * with the sensor's name over it - so the diagram shows which switch sits where along the
 * stroke. `tipAt(pos)` is the rod tip's centre x at stroke position `pos` (0 in, 1 out), and the
 * ticks run down to just above the rod tip at `tipTop`.
 */
export function drawSensorMarks(
  group: SVGGElement,
  sensors: CylinderSensor[],
  tipAt: (pos: number) => number,
  tipTop: number,
): void {
  group.replaceChildren();
  for (const sensor of sensors) {
    if (!isSensorLabelBound(sensor.label)) continue;
    const x = tipAt((sensor.minPct + sensor.maxPct) / 200);
    group.append(
      createSvgEl('line', {
        x1: x,
        y1: tipTop - 18,
        x2: x,
        y2: tipTop - 2,
        stroke: '#111',
        'stroke-width': 1.5,
      }),
    );
    const text = createSvgEl('text', {
      x,
      y: tipTop - 22,
      'text-anchor': 'middle',
      'font-size': 11,
      class: 'sensorMarkLabel',
    });
    text.textContent = sensor.label.toLowerCase();
    group.appendChild(text);
  }
}
