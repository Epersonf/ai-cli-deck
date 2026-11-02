export type KeysMode = 'auto' | 'on' | 'off';

const KEY = 'deck-keys-mode';
const ORDER: readonly KeysMode[] = ['auto', 'on', 'off'];

export const nextMode = (mode: KeysMode): KeysMode =>
  ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? 'auto';

/** "auto" shows the bar on touch screens only, so a desktop browser gets a clean terminal. */
export const keysVisible = (mode: KeysMode, touchScreen: boolean): boolean =>
  mode === 'on' || (mode === 'auto' && touchScreen);

export function loadMode(): KeysMode {
  try {
    const stored = localStorage.getItem(KEY);
    return ORDER.find((mode) => mode === stored) ?? 'auto';
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
