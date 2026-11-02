export interface ExplorerPrefs {
  /** Dotfiles and dotfolders. */
  hidden: boolean;
  /** Files git ignores, plus node_modules and .git. */
  ignored: boolean;
  /** Show ".ts" etc. at the end of file names. */
  extensions: boolean;
}

const KEY = 'deck-explorer-prefs';
export const DEFAULT_PREFS: ExplorerPrefs = { hidden: false, ignored: false, extensions: true };

export function loadPrefs(): ExplorerPrefs {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const flag = (name: keyof ExplorerPrefs): boolean =>
      typeof stored[name] === 'boolean' ? stored[name] : DEFAULT_PREFS[name];
    return { hidden: flag('hidden'), ignored: flag('ignored'), extensions: flag('extensions') };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ExplorerPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // preference only lasts for this page load
  }
}

/** The name as listed: without its last extension when extensions are hidden. */
export function displayName(name: string, kind: 'file' | 'dir', extensions: boolean): string {
  if (extensions || kind === 'dir') return name;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}
