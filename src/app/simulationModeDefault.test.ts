import { describe, expect, it } from 'vitest';
import { appState } from './AppState';

describe('simulation mode', () => {
  it('starts in flow mode', () => {
    expect(appState.simulationMode).toBe('flow');
  });
});
