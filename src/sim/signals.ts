/** Sensor bus: cylinders emit end-of-stroke signals (e.g. "a0"/"a1"), limit valves read them. */
const signals = new Map<string, boolean>();

export function setSignal(key: string, value: boolean): void {
  signals.set(key, value);
}

export function getSignal(key: string): boolean {
  return signals.get(key) ?? false;
}

export function resetSignals(): void {
  signals.clear();
}
