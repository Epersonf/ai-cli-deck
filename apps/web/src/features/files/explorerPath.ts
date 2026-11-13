const sepOf = (cwd: string): string => (cwd.includes('\\') && !cwd.includes('/') ? '\\' : '/');
const trimEnd = (text: string): string => text.replace(/[\\/]+$/, '');
const norm = (value: string): string => value.split('\\').join('/');
const parts = (value: string): string[] => norm(value).split('/').filter(Boolean);

/** Absolute path shown in the address bar for a folder relative to the session root (`..` climbs above it). */
export function toAbsolute(cwd: string, relative: string): string {
  const sep = sepOf(cwd);
  const rootParts = parts(cwd);
  const drive = /^[A-Za-z]:$/.test(rootParts[0] ?? '') ? rootParts.shift() : undefined;
  for (const part of relative.split('/').filter(Boolean)) {
    if (part === '..') rootParts.pop();
    else rootParts.push(part);
  }
  const body = rootParts.join(sep);
  if (drive !== undefined) return body === '' ? `${drive}${sep}` : `${drive}${sep}${body}`;
  return `${sep}${body}`;
}

/** Relative folder (with `..` to climb) for an absolute path typed in the address bar; null when it is not absolute. */
export function toRelative(cwd: string, typed: string): string | null {
  const text = trimEnd(typed.trim());
  const absolute = norm(text).startsWith('/') || /^[A-Za-z]:([\\/]|$)/.test(text);
  if (!absolute) return null;
  const root = parts(cwd);
  const target: string[] = [];
  for (const part of parts(text)) {
    if (part === '..') target.pop();
    else if (part !== '.') target.push(part);
  }
  let common = 0;
  while (common < root.length && common < target.length && root[common] === target[common])
    common += 1;
  return [...Array<string>(root.length - common).fill('..'), ...target.slice(common)].join('/');
}

/** The folder above a relative one; it can go above the session folder (`..`). */
export function parentOf(relative: string): string {
  const segments = relative.split('/').filter(Boolean);
  if (segments.length === 0 || segments[segments.length - 1] === '..')
    return [...segments, '..'].join('/');
  return segments.slice(0, -1).join('/');
}

/** True when the folder is the top of the file system, so there is nothing above it. */
export const isTop = (cwd: string, relative: string): boolean =>
  /^([A-Za-z]:)?[\\/]?$/.test(toAbsolute(cwd, relative));
