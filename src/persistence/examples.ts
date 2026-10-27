import type { ProjectFileV1, ComponentSnapshot, ConnectionSnapshot } from './schema';
import { CURRENT_SCHEMA_VERSION } from './schema';
import { createComponent } from '../components/registry';

/** Each component type's own data as freshly placed, built once from a throwaway instance (like
 * the library icons, see iconPreview.ts). A load hands a component its saved data as-is, so an
 * example gives every part its full data - the defaults, with the example's own settings on top
 * - rather than only the few fields it cares about. */
const defaultsByType = new Map<string, Record<string, unknown>>();

function defaultData(type: string): Record<string, unknown> {
  let data = defaultsByType.get(type);
  if (!data) {
    const comp = createComponent(type, { compLayer: document.createElement('div') }, 0, 0);
    data = comp.snapshot();
    // A cylinder's sensors are named after its letter (A0, A1): leave them out so they're made
    // for the letter the example gives it, not whatever letter the throwaway one got.
    delete data.sensors;
    comp.destroy?.();
    defaultsByType.set(type, data);
  }
  return data;
}

/** Small builder so the example circuits below read as a parts list plus a wiring list. */
function circuit(name: string, build: (b: Builder) => void): ProjectFileV1 {
  const comps: ComponentSnapshot[] = [];
  const conns: ConnectionSnapshot[] = [];
  let next = 1;
  const b: Builder = {
    add(type, x, y, data = {}, rot) {
      const id = next++;
      comps.push({
        id,
        type,
        x,
        y,
        data: { ...defaultData(type), ...data },
        ...(rot ? { rot } : {}),
      });
      return id;
    },
    wire(a, ap, c, cp) {
      conns.push({
        from: { id: a, port: ap },
        to: { id: c, port: cp },
        guides: [],
        stubStartLen: null,
        stubEndLen: null,
      });
    },
  };
  build(b);
  return { schemaVersion: CURRENT_SCHEMA_VERSION, name, comps, conns };
}

interface Builder {
  add(type: string, x: number, y: number, data?: Record<string, unknown>, rot?: number): number;
  wire(a: number, ap: string, b: number, bp: string): void;
}

/** A pressure source whose outlet sits `below` px under the port at (x, y), feeding it. */
function supply(b: Builder, id: number, port: string, x: number, y: number, below = 40): void {
  const source = b.add('source', x, y + below + 20);
  b.wire(source, 'OUT', id, port);
}

export const EXAMPLES: Array<{ title: string; file: () => ProjectFileV1 }> = [
  {
    title: 'Direct control of a single-acting cylinder',
    file: () =>
      // Press the push button (hold Ctrl to latch it) and the cylinder extends; let go and its
      // spring brings it back as the valve vents it.
      circuit('Example - direct control', (b) => {
        const cyl = b.add('cylinderSingle', 400, 160, { letter: 'A' });
        const button = b.add('pushButton32', 310, 330, { showName: true, customName: 'Start' });
        b.wire(button, '2', cyl, 'A');
        supply(b, button, '1', 330, 370);
      }),
  },
  {
    title: 'Indirect control, speed set by a flow control (meter-out)',
    file: () =>
      // The push button pilots a spring-return 5/2 valve, which drives a double-acting cylinder.
      // The one-way flow control throttles the air leaving the rod side, so the cylinder extends
      // at a steady, adjustable speed and returns at full speed.
      circuit('Example - indirect control, meter-out', (b) => {
        const cyl = b.add('cylinderDouble', 420, 120, { letter: 'A' });
        const valve = b.add('valve52Mono', 420, 380);
        const flow = b.add('oneWayFlowControlValve', 510, 240, { flowPct: 30 });
        const button = b.add('pushButton32', 160, 460, { showName: true, customName: 'Start' });
        b.wire(valve, '4', cyl, 'A');
        b.wire(valve, '2', flow, 'IN');
        b.wire(flow, 'OUT', cyl, 'B');
        b.wire(button, '2', valve, '14');
        supply(b, valve, '1', 440, 420, 50);
        supply(b, button, '1', 180, 500, 50);
      }),
  },
  {
    title: 'One automatic cycle: start AND A0, back at A1',
    file: () =>
      // Press Start while the cylinder is in (limit valve A0 held down): the AND valve passes
      // the signal to pilot 14 and the cylinder extends. At the end of the stroke limit valve A1
      // pilots 12 and it comes back. Hold Start down for continuous cycling.
      circuit('Example - automatic cycle', (b) => {
        const cyl = b.add('cylinderDouble', 480, 100, { letter: 'A' });
        const valve = b.add('valve52', 470, 300);
        const and = b.add('andValve', 250, 400);
        const start = b.add('pushButton32', 100, 540, { showName: true, customName: 'Start' });
        const a0 = b.add('limitValve32', 400, 540, { sensorKey: 'A0' });
        const a1 = b.add('limitValve32', 650, 450, { sensorKey: 'A1' });
        b.wire(valve, '4', cyl, 'A');
        b.wire(valve, '2', cyl, 'B');
        b.wire(start, '2', and, 'A');
        b.wire(a0, '2', and, 'B');
        b.wire(and, 'OUT', valve, '14');
        b.wire(a1, '2', valve, '12');
        supply(b, valve, '1', 490, 340, 50);
        supply(b, start, '1', 120, 580);
        supply(b, a0, '1', 420, 580);
        supply(b, a1, '1', 670, 490);
      }),
  },
];
