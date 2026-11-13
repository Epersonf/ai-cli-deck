import { readdir } from 'node:fs/promises';
import { posix } from 'node:path';

/** Folders that are never worth offering: dependencies, build output, caches. */
const SKIP = new Set([
  'node_modules',
  'dist',
  'build',
  'target',
  'out',
  'coverage',
  '__pycache__',
  'venv',
]);
export const MAX_FILES = 5000;
const MAX_DEPTH = 8;
const TTL_MS = 10_000;

/** Every file under `root` (relative, `/`-separated), breadth first so shallow files win when the cap is hit. */
export async function listProjectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  let level = [''];
  for (
    let depth = 0;
    depth <= MAX_DEPTH && level.length > 0 && files.length < MAX_FILES;
    depth += 1
  ) {
    const next: string[] = [];
    for (const dir of level) {
      const entries = await readdir(posix.join(root, dir), { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!SKIP.has(entry.name)) next.push(path);
        } else if (entry.isFile() && files.length < MAX_FILES) files.push(path);
      }
    }
    level = next;
  }
  return files;
}

/** Characters of `query` appear in `text` in order (a loose, editor-style match). */
const subsequence = (text: string, query: string): boolean => {
  let at = 0;
  for (const char of text) if (char === query[at]) at += 1;
  return at === query.length;
};

/** Files that match what was typed, best first: name starts with it, name contains it, path contains it, loose match. */
export function rankFiles(files: readonly string[], query: string, limit: number): string[] {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return [...files].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b)).slice(0, limit);
  }
  const scored: Array<{ path: string; score: number }> = [];
  for (const path of files) {
    const lower = path.toLowerCase();
    const name = posix.basename(lower);
    const score =
      name === q
        ? 0
        : name.startsWith(q)
          ? 1
          : name.includes(q)
            ? 2
            : lower.includes(q)
              ? 3
              : subsequence(lower, q)
                ? 4
                : -1;
    if (score >= 0) scored.push({ path, score });
  }
  return scored
    .sort(
      (a, b) => a.score - b.score || a.path.length - b.path.length || a.path.localeCompare(b.path),
    )
    .slice(0, limit)
    .map((s) => s.path);
}

const depth = (path: string): number => path.split('/').length;

/** Remembers each folder's file list for a few seconds: typing after `@` asks again on every key. */
export class FileFinder {
  private readonly cache = new Map<string, { at: number; files: string[] }>();

  constructor(private readonly now: () => number = Date.now) {}

  async find(root: string, query: string, limit: number): Promise<string[]> {
    const hit = this.cache.get(root);
    const files = hit && this.now() - hit.at < TTL_MS ? hit.files : await listProjectFiles(root);
    if (hit?.files !== files) this.cache.set(root, { at: this.now(), files });
    return rankFiles(files, query, limit);
  }
}
