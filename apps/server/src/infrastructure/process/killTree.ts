import { spawn, type ChildProcess } from 'node:child_process';

/** Ends a child and everything it started (a plain kill leaves the grandchildren on Windows). */
export function killTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else child.kill('SIGTERM');
}
