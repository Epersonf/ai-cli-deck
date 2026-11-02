export type ModifierMode = 'off' | 'armed' | 'locked';

export interface StickyModifier {
  mode: ModifierMode;
  armedAt: number;
}

export const OFF: StickyModifier = { mode: 'off', armedAt: 0 };
export const DOUBLE_TAP_MS = 400;

/** Tap once to arm, tap again quickly to lock, tap again to release. */
export function tap(state: StickyModifier, now: number): StickyModifier {
  if (state.mode === 'off') return { mode: 'armed', armedAt: now };
  if (state.mode === 'armed' && now - state.armedAt <= DOUBLE_TAP_MS) {
    return { mode: 'locked', armedAt: state.armedAt };
  }
  return OFF;
}

/** An armed modifier applies to exactly one key; a locked one stays until tapped. */
export const consume = (state: StickyModifier): StickyModifier =>
  state.mode === 'armed' ? OFF : state;

export const isActive = (state: StickyModifier): boolean => state.mode !== 'off';
