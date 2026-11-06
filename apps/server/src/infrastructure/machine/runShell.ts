import { spawn } from 'node:child_process';
import type { ExecResult } from '@deck/shared';

/** Output kept per command: the end, where results and errors are. */
const MAX_OUTPUT = 200_000;

export interface ShellOptions {
  cwd: string;
  timeoutSec: number;
  env: NodeJS.ProcessEnv;
  /** The shell to run it with (cmd.exe on Windows, the user's shell elsewhere). */
  shell: string;
}

/** Stops the command and everything it started. */
function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL'); // its own process group (detached)
  } catch {
    // already gone
  }
}

/** Runs one command in a shell and waits for it, with a time limit; never throws for a failing command. */
export function runShell(command: string, options: ShellOptions): Promise<ExecResult> {
  const windows = process.platform === 'win32';
  // cmd.exe speaks the console code page; UTF-8 keeps accents and symbols readable.
  const line = windows ? `chcp 65001 >nul & ${command}` : command;
  const child = spawn(options.shell, windows ? ['/d', '/s', '/c', `"${line}"`] : ['-c', line], {
    cwd: options.cwd,
    env: options.env,
    detached: !windows,
    windowsVerbatimArguments: windows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let truncated = false;
  const keep = (chunk: Buffer): void => {
    output += chunk.toString('utf8');
    if (output.length > MAX_OUTPUT) {
      output = output.slice(-MAX_OUTPUT);
      truncated = true;
    }
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid) killTree(child.pid);
  }, options.timeoutSec * 1000);
  const base = { shell: options.shell, platform: process.platform, cwd: options.cwd };
  return new Promise((resolve) => {
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ...base, exitCode: null, output: error.message, truncated, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ...base, exitCode: timedOut ? null : code, output, truncated, timedOut });
    });
  });
}
