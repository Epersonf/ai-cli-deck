export type KeysMode = 'auto' | 'on' | 'off';

const KEY = 'deck-keys-mode';
export const KEYS_MODES: readonly KeysMode[] = ['auto', 'on', 'off'];

export const nextMode = (mode: KeysMode): KeysMode =>
  KEYS_MODES[(KEYS_MODES.indexOf(mode) + 1) % KEYS_MODES.length] ?? 'auto';

/** "auto" shows the bar on touch screens only, so a desktop browser gets a clean terminal. */
export const keysVisible = (mode: KeysMode, touchScreen: boolean): boolean =>
  mode === 'on' || (mode === 'auto' && touchScreen);

export function loadMode(): KeysMode {
  try {
    const stored = localStorage.getItem(KEY);
    return KEYS_MODES.find((mode) => mode === stored) ?? 'auto';
  } catch {
    return 'auto';
  }
}

export function saveMode(mode: KeysMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // preference only lasts for this page load
  }
}
