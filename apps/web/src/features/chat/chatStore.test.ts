import type { ChatConfig } from '@deck/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { useChats } from './chatStore';

const config: ChatConfig = {
  agent: 'claude',
  model: null,
  mode: 'default',
  effort: null,
  autoCompact: null,
  modelChoices: [],
  effectiveModel: null,
  defaultModel: null,
  chatId: null,
};
const state = () => useChats.getState().byId['s'];

describe('chat store', () => {
  beforeEach(() => useChats.setState({ byId: {} }));

  it('keeps tasks out of the rows and upserts them', () => {
    const chats = useChats.getState();
    chats.event('s', { t: 'task', id: 'a', title: 'dev server', state: 'running' });
    chats.event('s', { t: 'task', id: 'a', title: 'dev server', state: 'stopped' });
    expect(state()?.blocks).toEqual([]);
    expect(state()?.tasks).toEqual([{ id: 'a', title: 'dev server', state: 'stopped' }]);
  });

  it('replaces the whole chat on a reset, tasks included', () => {
    const chats = useChats.getState();
    chats.replay('s', {
      events: [
        { t: 'user', id: 'u1', text: 'one', attachments: [], at: '' },
        { t: 'task', id: 'a', title: 'x', state: 'running' },
      ],
      partials: [],
      busy: false,
      config,
    });
    chats.reset('s', [{ t: 'user', id: 'u1', text: 'edited', attachments: [], at: '' }]);
    expect(state()?.blocks).toHaveLength(1);
    expect(state()?.blocks[0]).toMatchObject({ text: 'edited' });
    expect(state()?.tasks).toEqual([]);
  });

  it('stores usage and follows turns for the busy light', () => {
    const chats = useChats.getState();
    chats.event('s', { t: 'turn-start' });
    expect(state()?.busy).toBe(true);
    chats.event('s', { t: 'turn-end', error: null, costUsd: null, durationMs: null });
    expect(state()?.busy).toBe(false);
    chats.setUsage('s', {
      costUsd: 0.2,
      contextTokens: 10,
      contextWindow: 100,
      limits: [],
      cache: null,
    });
    expect(state()?.usage?.costUsd).toBe(0.2);
  });
});
