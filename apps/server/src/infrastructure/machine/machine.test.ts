import { describe, expect, it } from 'vitest';
import { defaultShell } from '../config/platform.js';
import { runShell } from './runShell.js';

const windows = process.platform === 'win32';
const shell = windows ? defaultShell(process.env, 'win32') : '/bin/sh';
const options = (timeoutSec = 20) => ({ cwd: process.cwd(), timeoutSec, env: process.env, shell });

describe('running a command for an agent', () => {
  it('returns the output and the exit code', async () => {
    const result = await runShell('echo hello deck && exit 3', options());
    expect(result.output).toContain('hello deck');
    expect(result.exitCode).toBe(3);
    expect(result.timedOut).toBe(false);
  });

  it('stops a command that takes too long', async () => {
    const slow = windows ? 'ping -n 30 127.0.0.1 >nul' : 'sleep 30';
    const result = await runShell(slow, options(1));
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
  }, 15_000);
});
