import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast, useToast } from './toast';

describe('toast', () => {
  afterEach(() => vi.useRealTimers());

  it('appears and disappears by itself', () => {
    vi.useFakeTimers();
    toast('Copied');
    expect(useToast.getState().text).toBe('Copied');
    vi.advanceTimersByTime(1600);
    expect(useToast.getState().text).toBeNull();
  });

  it('a newer message restarts the time', () => {
    vi.useFakeTimers();
    toast('one');
    vi.advanceTimersByTime(1000);
    toast('two');
    vi.advanceTimersByTime(1000);
    expect(useToast.getState().text).toBe('two');
    vi.advanceTimersByTime(600);
    expect(useToast.getState().text).toBeNull();
  });
});
