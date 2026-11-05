import { lstat, readFile, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitChange, GitDiff } from '@deck/shared';
import type { GitReviewPort } from '../../domain/ports.js';
import type { GitRun } from './gitRun.js';
import { newFileDiff, parsePorcelainZ, type ParsedStatus } from './porcelain.js';

const MAX_DIFF = 256 * 1024;
const PUSH_MS = 90_000;
const RESTORE = ['restore', '--source=HEAD', '--staged', '--worktree', '--'];

/** Every path a change touches (a rename touches its old path too). */
const pathsOf = (changes: readonly GitChange[]): string[] =>
  changes.flatMap((c) => (c.from ? [c.path, c.from] : [c.path]));

/** Reviewing, discarding, committing and pushing what changed in a repository, with git itself. */
export class GitReviewCli implements GitReviewPort {
  constructor(private readonly git: GitRun) {}

  async root(cwd: string): Promise<string | null> {
    try {
      return (await this.git(['rev-parse', '--show-toplevel'], cwd)).out.trim() || null;
    } catch {
      return null;
    }
  }

  async status(root: string): Promise<ParsedStatus> {
    const args = ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all'];
    return parsePorcelainZ((await this.git(args, root)).out);
  }

  async diff(root: string, change: GitChange): Promise<GitDiff> {
    const text =
      change.code === '??'
        ? await this.untracked(root, change.path)
        : await this.tracked(root, change);
    const truncated = text.length > MAX_DIFF;
    return { path: change.path, diff: truncated ? text.slice(0, MAX_DIFF) : text, truncated };
  }

  async discard(root: string, change: GitChange): Promise<void> {
    if (change.code === '??') return this.removeNew(root, change.path);
    if (change.code[0] === 'R' && change.from) {
      await this.git([...RESTORE, change.from], root);
      return this.removeNew(root, change.path, true);
    }
    if (change.code[0] === 'A') return this.removeNew(root, change.path, true);
    await this.git([...RESTORE, change.path], root);
  }

  async commit(root: string, message: string, changes: readonly GitChange[]): Promise<string> {
    const paths = pathsOf(changes);
    await this.git(['add', '-A', '--', ...paths], root);
    return (await this.git(['commit', '-m', message, '--', ...paths], root)).out.trim();
  }

  async push(root: string): Promise<string> {
    const { out, err } = await this.git(['push'], root, PUSH_MS);
    return `${out}${err}`.trim();
  }

  private async hasHead(root: string): Promise<boolean> {
    try {
      await this.git(['rev-parse', '--verify', '-q', 'HEAD'], root);
      return true;
    } catch {
      return false;
    }
  }

  private async tracked(root: string, change: GitChange): Promise<string> {
    const paths = ['--', ...pathsOf([change])];
    if (await this.hasHead(root))
      return (await this.git(['diff', '-M', 'HEAD', ...paths], root)).out;
    // No commit yet: what is staged, then what changed since.
    const staged = await this.git(['diff', '--cached', ...paths], root);
    const unstaged = await this.git(['diff', ...paths], root);
    return staged.out + unstaged.out;
  }

  private async untracked(root: string, path: string): Promise<string> {
    const full = join(root, path);
    const info = await lstat(full);
    if (info.isSymbolicLink()) return newFileDiff(path, `-> ${await readlink(full)}\n`);
    if (info.size > MAX_DIFF * 4) return `New file ${path} (${info.size} bytes)\n`;
    return newFileDiff(path, await readFile(full, 'utf8'));
  }

  /** Drops a file git did not have before: out of the index if it was added, then off the disk. */
  private async removeNew(root: string, path: string, staged = false): Promise<void> {
    if (staged) await this.git(['rm', '-q', '--cached', '-f', '--', path], root);
    await this.git(['clean', '-f', '-q', '--', path], root);
  }
}
