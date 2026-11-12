// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { usePins } from './pinStore';

describe('pinned folder', () => {
  beforeEach(() => usePins.setState({ from: {} }));

  it('remembers the base before pinning, and unpinning really clears it', () => {
    usePins.getState().pin('s1', '/work');
    expect(usePins.getState().from['s1']).toBe('/work');
    usePins.getState().pin('s1', '/work/api'); // pinned again, deeper: still goes back to the first base
    expect(usePins.getState().from['s1']).toBe('/work');
    usePins.getState().unpin('s1');
    expect(usePins.getState().from).toEqual({});
    expect(localStorage.getItem('deck-pinned-from')).toBe('{}');
  });
});
