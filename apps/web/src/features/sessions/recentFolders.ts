import { PEER_ID } from '../../shared/api/base';

/** Per deck: a paired deck is shown through this origin, so its folders must not leak into this deck's list. */
const KEY = `deck-recent-cwds:${PEER_ID ?? 'local'}`;
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

/** Drops a folder that no longer exists (or never existed on this machine) from the recent list. */
export function forgetFolder(cwd: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadRecent().filter((x) => x !== cwd)));
  } catch {
    // storage unavailable: recents are a convenience only
  }
}
