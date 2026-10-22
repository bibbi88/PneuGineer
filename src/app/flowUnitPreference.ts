const STORAGE_KEY = 'pneugineer.flowRatingUnit';

/** How the inspector shows and takes components' flow ratings: as the ISO 6358 sonic
 * conductance C, or as the standard nominal flow in Nl/min that valve data sheets usually quote.
 * A personal preference, like the grid - not part of any one project. */
export type FlowRatingUnit = 'C' | 'Nl/min';

export function loadFlowRatingUnit(): FlowRatingUnit {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'Nl/min' ? 'Nl/min' : 'C';
  } catch {
    return 'C';
  }
}

export function saveFlowRatingUnit(unit: FlowRatingUnit): void {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // Private browsing / storage disabled - the choice just won't survive a reload.
  }
}
