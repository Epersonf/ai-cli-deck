import { spawn } from 'node:child_process';
import type { ProcessHandle, ProcessPort, ProcessSpec } from '../../domain/ports.js';

/** Stops the command and everything it started. */
function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
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

/** Background commands as plain child processes (stdout and stderr together, no terminal). */
export class ChildProcessAdapter implements ProcessPort {
  spawn(spec: ProcessSpec): ProcessHandle {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const data: ((chunk: Uint8Array) => void)[] = [];
    const exit: ((code: number | null) => void)[] = [];
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk: Buffer) => data.forEach((listener) => listener(chunk)));
    let ended = false;
    const finish = (code: number | null): void => {
      if (ended) return;
      ended = true;
      exit.forEach((listener) => listener(code));
    };
    child.on('error', () => finish(null));
    child.on('close', (code) => finish(code));
    return {
      onData: (listener) => void data.push(listener),
      onExit: (listener) => void exit.push(listener),
      kill: () => killTree(child.pid),
    };
  }
}
