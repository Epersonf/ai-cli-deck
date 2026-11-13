import { beforeEach, describe, expect, it } from 'vitest';
import { useQueue } from './queueStore';

describe('queued messages', () => {
  beforeEach(() => useQueue.setState({ byId: {} }));

  it('keeps the order, drains once and keeps chats apart', () => {
    const q = useQueue.getState();
    q.add('a', 'one', []);
    q.add('a', 'two', []);
    q.add('b', 'other', []);
    expect(
      useQueue
        .getState()
        .drain('a')
        .map((m) => m.text),
    ).toEqual(['one', 'two']);
    expect(useQueue.getState().drain('a')).toEqual([]);
    expect(useQueue.getState().byId.b?.length).toBe(1);
  });

  it('takes one message out to send it now', () => {
    const q = useQueue.getState();
    q.add('a', 'one', []);
    q.add('a', 'two', []);
    const id = useQueue.getState().byId.a?.[1]?.id ?? -1;
    expect(useQueue.getState().take('a', id)?.text).toBe('two');
    expect(useQueue.getState().byId.a?.map((m) => m.text)).toEqual(['one']);
    expect(useQueue.getState().take('a', id)).toBeUndefined();
  });
});
