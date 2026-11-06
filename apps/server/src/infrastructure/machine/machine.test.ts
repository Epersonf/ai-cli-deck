import { describe, expect, it } from 'vitest';
import { defaultShell } from '../config/platform.js';
import { runShell } from './runShell.js';
import { screenText } from './screenText.js';

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

describe('a terminal screen as text', () => {
  it('draws what a person would see, without escape codes', async () => {
    const bytes = Buffer.from('noise\x1b[2J\x1b[H\x1b[1;32mhello\x1b[0m\r\nworld\x1b[3;1Hthird');
    const text = await screenText(bytes, { cols: 20, rows: 5 }, 10);
    expect(text.split('\n').slice(-3)).toEqual(['hello', 'world', 'third']);
  });

  it('keeps only the last lines asked for', async () => {
    const bytes = Buffer.from(Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\r\n'));
    const text = await screenText(bytes, { cols: 20, rows: 5 }, 2);
    expect(text).toBe('line 28\nline 29');
  });
});
