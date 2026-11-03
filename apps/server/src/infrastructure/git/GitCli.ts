import type { GitStatus } from '@deck/shared';
import type { GitPort, WorktreePort } from '../../domain/ports.js';
import type { Runner } from '../tmux/exec.js';

/** Parses `git status --porcelain=v1 -b` output. */
export function parseGitStatus(output: string): GitStatus {
  const lines = output.split('\n').filter((line) => line.length > 0);
  const header = lines.find((line) => line.startsWith('## '));
  const branch = header ? (header.slice(3).split('...')[0] ?? null) : null;
  const changes = lines
    .filter((line) => !line.startsWith('## '))
    .map((line) => ({ code: line.slice(0, 2).trim() || '?', path: line.slice(3) }));
  return { isRepo: true, branch, changes };
}

/** Re-bases repo-root paths onto a sub-folder; changes outside it are left untouched. */
export function relativeTo(prefix: string, changes: GitStatus['changes']): GitStatus['changes'] {
  if (prefix === '') return changes;
  return changes.map((c) =>
    c.path.startsWith(prefix) ? { ...c, path: c.path.slice(prefix.length) } : c,
  );
}

const CHUNK = 200;
const exitCodeOf = (error: unknown): unknown => (error as { code?: unknown }).code;

/** Parses the NUL-separated output of `git check-ignore -z`. */
export const parseIgnored = (output: string): string[] => output.split('\0').filter(Boolean);

export class GitCli implements GitPort, WorktreePort {
  constructor(private readonly run: Runner) {}

  async status(cwd: string): Promise<GitStatus> {
    try {
      const status = parseGitStatus(
        await this.run('git', ['status', '--porcelain=v1', '-b', '--untracked-files=all'], cwd),
      );
      // Porcelain paths are relative to the repo root; the explorer works from `cwd`.
      const prefix = (await this.run('git', ['rev-parse', '--show-prefix'], cwd)).trim();
      return { ...status, changes: relativeTo(prefix, status.changes) };
    } catch {
      return { isRepo: false, branch: null, changes: [] };
    }
  }

  async ignoredPaths(cwd: string, paths: readonly string[]): Promise<Set<string>> {
    const ignored = new Set<string>();
    for (let i = 0; i < paths.length; i += CHUNK) {
      const chunk = paths.slice(i, i + CHUNK);
      try {
        const out = await this.run('git', ['check-ignore', '-z', '--', ...chunk], cwd);
        parseIgnored(out).forEach((path) => ignored.add(path));
      } catch (error) {
        // exit 1 = nothing ignored, 128 = not a repository: both mean "nothing to mark".
        if (exitCodeOf(error) !== 1 && exitCodeOf(error) !== 128) throw error;
      }
    }
    return ignored;
  }

  async add(input: { repoDir: string; branch: string; targetPath: string }): Promise<void> {
    const args = ['worktree', 'add', '-b', input.branch, input.targetPath];
    await this.run('git', args, input.repoDir);
  }
}
