import type { GitChange } from '@deck/shared';

export interface ParsedStatus {
  branch: string | null;
  ahead: number | null;
  changes: GitChange[];
}

/** The `## ...` header of `git status -b`: branch and how far ahead of its upstream. */
export function parseBranch(header: string): Pick<ParsedStatus, 'branch' | 'ahead'> {
  const unborn = /^No commits yet on (.+)$/.exec(header);
  if (unborn) return { branch: unborn[1] ?? null, ahead: null };
  if (header.startsWith('HEAD (no branch)')) return { branch: null, ahead: null };
  const [name, rest] = header.split('...');
  if (rest === undefined) return { branch: name?.trim() || null, ahead: null };
  const ahead = /\[ahead (\d+)/.exec(rest);
  return { branch: name ?? null, ahead: ahead ? Number(ahead[1]) : 0 };
}

/** Parses `git status --porcelain=v1 -z -b`: NUL separated, a rename or copy followed by its old path. */
export function parsePorcelainZ(output: string): ParsedStatus {
  const entries = output.split('\0');
  let branch: Pick<ParsedStatus, 'branch' | 'ahead'> = { branch: null, ahead: null };
  const changes: GitChange[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] ?? '';
    if (entry === '') continue;
    if (entry.startsWith('## ')) {
      branch = parseBranch(entry.slice(3));
      continue;
    }
    const code = entry.slice(0, 2);
    const change: GitChange = { code, path: entry.slice(3) };
    if (code[0] === 'R' || code[0] === 'C') {
      i += 1;
      const from = entries[i];
      if (from) change.from = from;
    }
    changes.push(change);
  }
  return { ...branch, changes };
}

/** A diff for a file git does not track yet: every line added. */
export function newFileDiff(path: string, text: string): string {
  if (text.slice(0, 8000).includes('\0')) return `Binary file ${path} (new)\n`;
  const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
  const body = text === '' ? [] : lines.map((line) => `+${line}`);
  return [`--- /dev/null`, `+++ b/${path}`, `@@ -0,0 +1,${body.length} @@`, ...body, ''].join('\n');
}
