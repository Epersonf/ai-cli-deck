import { beforeEach, describe, expect, it } from 'vitest';
import { queuedOf, useQueue } from './queueStore';

describe('queued messages', () => {
  beforeEach(() => useQueue.setState({ byId: {} }));

  it('shows the list the server sends, per chat', () => {
    useQueue.getState().set('a', [{ id: '1', text: 'one', images: 0 }]);
    useQueue.getState().set('b', []);
    expect(queuedOf('a')(useQueue.getState()).map((q) => q.text)).toEqual(['one']);
    expect(queuedOf('b')(useQueue.getState())).toEqual([]);
    useQueue.getState().set('a', []);
    expect(queuedOf('a')(useQueue.getState())).toEqual([]);
  });
});
