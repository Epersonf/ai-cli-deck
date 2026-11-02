const KEY = 'deck-recent-cwds';
const MAX = 8;

export function loadRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberFolder(cwd: string): void {
  try {
    const next = [cwd, ...loadRecent().filter((x) => x !== cwd)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recents are a convenience only
  }
}
