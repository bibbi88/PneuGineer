/** Sensor bus: cylinders emit end-of-stroke signals (e.g. "a0"/"a1"), limit valves read them.
 * Keys are normalized to a single case so "A1" and "a1" are treated as the same sensor
 * regardless of which case either side happened to type/emit it in. */
const signals = new Map<string, boolean>();

function normalize(key: string): string {
  return key.trim().toUpperCase();
}

export function setSignal(key: string, value: boolean): void {
  signals.set(normalize(key), value);
}

export function getSignal(key: string): boolean {
  return signals.get(normalize(key)) ?? false;
}

/** Which way the cylinder carrying each sensor is moving this frame: +1 extending, -1
 * retracting, 0 still - what a one-way roller lever goes by (it trips one way only). */
const motions = new Map<string, number>();

export function setSignalMotion(key: string, dir: number): void {
  motions.set(normalize(key), Math.sign(dir));
}

export function getSignalMotion(key: string): number {
  return motions.get(normalize(key)) ?? 0;
}

export function resetSignals(): void {
  signals.clear();
  motions.clear();
}
