import { describe, expect, it, vi } from 'vitest';
import { acquireWakeLock } from './wakeLock.js';

describe('acquireWakeLock', () => {
  it('asks Termux for the lock', async () => {
    const run = vi.fn().mockResolvedValue('');
    expect(await acquireWakeLock(run, {})).toBe(true);
    expect(run).toHaveBeenCalledWith('termux-wake-lock', []);
  });

  it('does nothing when disabled', async () => {
    const run = vi.fn();
    expect(await acquireWakeLock(run, { DECK_WAKE_LOCK: '0' })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('is quiet when Termux is not there', async () => {
    const run = vi.fn().mockRejectedValue(new Error('ENOENT'));
    expect(await acquireWakeLock(run, {})).toBe(false);
  });
});
