import { execFile } from 'node:child_process';
import { conflict } from '../../domain/errors.js';

export interface GitOutput {
  out: string;
  err: string;
}
/** Runs one git command in `cwd`; a failure carries git's own message. */
export type GitRun = (args: string[], cwd: string, timeoutMs?: number) => Promise<GitOutput>;

/**
 * Paths are taken literally (no pathspec magic) and printed unquoted; git never waits for a password, so a
 * push without credentials fails instead of hanging.
 */
export const runGit: GitRun = (args, cwd, timeoutMs = 20_000) =>
  new Promise((resolve, reject) => {
    execFile(
      'git',
      ['--literal-pathspecs', '-c', 'core.quotePath=false', '-c', 'color.ui=false', ...args],
      {
        cwd,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        timeout: timeoutMs,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
      (error, out, err) => {
        if (!error) return resolve({ out, err });
        reject(conflict(err.trim() || error.message));
      },
    );
  });
