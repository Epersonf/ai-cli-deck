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

export class GitCli implements GitPort, WorktreePort {
  constructor(private readonly run: Runner) {}

  async status(cwd: string): Promise<GitStatus> {
    try {
      return parseGitStatus(await this.run('git', ['status', '--porcelain=v1', '-b'], cwd));
    } catch {
      return { isRepo: false, branch: null, changes: [] };
    }
  }

  async add(input: { repoDir: string; branch: string; targetPath: string }): Promise<void> {
    const args = ['worktree', 'add', '-b', input.branch, input.targetPath];
    await this.run('git', args, input.repoDir);
  }
}
