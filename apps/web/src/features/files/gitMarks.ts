export type GitTone = 'modified' | 'added' | 'deleted' | 'other';

/** Colour family for a `git status --porcelain` code: yellow modified, green new, red deleted. */
export function toneOf(code: string): GitTone {
  if (code.includes('U') && code !== '??') return 'deleted'; // merge conflict
  if (code.includes('D')) return 'deleted';
  if (code === '??' || code.includes('A')) return 'added';
  if (code.includes('M')) return 'modified';
  return 'other';
}

/** Letter shown beside the name ("??" reads as "U" for untracked, like most editors). */
export const labelOf = (code: string): string => (code === '??' ? 'U' : code);

/** Folders that contain at least one changed file, so a change is visible before opening them. */
export function changedFolders(paths: Iterable<string>): Set<string> {
  const folders = new Set<string>();
  for (const raw of paths) {
    const parts = raw.replace(/\/$/, '').split('/');
    for (let i = 1; i < parts.length; i += 1) folders.add(parts.slice(0, i).join('/'));
  }
  return folders;
}
