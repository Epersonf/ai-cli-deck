const sepOf = (cwd: string): string => (cwd.includes('\\') && !cwd.includes('/') ? '\\' : '/');
const trimEnd = (text: string): string => text.replace(/[\\/]+$/, '');

/** Absolute path shown in the address bar for a folder relative to the session root. */
export function toAbsolute(cwd: string, relative: string): string {
  const sep = sepOf(cwd);
  const root = trimEnd(cwd) || sep;
  if (relative === '') return root;
  const tail = relative.split('/').join(sep);
  return root === sep ? `${sep}${tail}` : `${root}${sep}${tail}`;
}

/** Relative folder for text typed in the address bar, or null when it leaves the session root. */
export function toRelative(cwd: string, typed: string): string | null {
  const root = trimEnd(cwd);
  const text = trimEnd(typed.trim());
  const norm = (value: string): string => value.split('\\').join('/');
  if (norm(text) === norm(root) || (text === '' && root === '')) return '';
  if (!norm(text).startsWith(`${norm(root)}/`)) return null;
  const parts = norm(text)
    .slice(norm(root).length + 1)
    .split('/')
    .filter(Boolean);
  return parts.some((part) => part === '..') ? null : parts.join('/');
}

export const parentOf = (relative: string): string => relative.split('/').slice(0, -1).join('/');
