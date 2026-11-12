import { afterEach, describe, expect, it, vi } from 'vitest';
import { filesMayHaveChanged, useFilesTick } from './filesTick';

describe('files tick', () => {
  afterEach(() => vi.useRealTimers());

  it('bumps once for a burst of tool results', () => {
    vi.useFakeTimers();
    useFilesTick.setState({ byId: {} });
    filesMayHaveChanged('s');
    filesMayHaveChanged('s');
    filesMayHaveChanged('s');
    vi.advanceTimersByTime(500);
    expect(useFilesTick.getState().byId['s']).toBe(1);
  });
});
