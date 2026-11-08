import { describe, expect, it } from 'vitest';
import type { ChatEntry } from '../domain/chat.js';
import { createHarness, customBody } from '../testing/harness.js';

const claude = { ...customBody('/work'), provider: 'claude', command: null };
/** Minutes after the deck's fake "now" (2026-01-01 00:00 UTC), when every run starts. */
const at = (minutes: number): Date => new Date(Date.UTC(2026, 0, 1, 0, minutes));
const chat = (id: string, started: number, updated: number): ChatEntry => ({
  id,
  path: `/chats/${id}.jsonl`,
  title: `chat ${id}`,
  startedAt: at(started),
  updatedAt: at(updated),
});

describe('which conversation a terminal is on', () => {
  it('takes the one the CLI reported, when it reports', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(claude);
    h.reader.chats = [chat('newer', 0, 10), chat('mine', 0, 1)];
    h.chatFiles.reports.set(id, { id: 'mine', path: '' });
    expect((await h.chats.current(id))?.id).toBe('mine');
  });

  it('otherwise takes the newest chat touched since the run started, not another terminal’s', async () => {
    const h = createHarness();
    const a = await h.sessions.create(claude);
    const b = await h.sessions.create(claude);
    h.reader.chats = [chat('before', -90, -60), chat('of-a', 1, 5), chat('of-b', 2, 6)];
    h.chatFiles.reports.set(b.id, { id: 'of-b', path: '' });
    expect((await h.chats.current(a.id))?.id).toBe('of-a');
  });

  it('keeps the chat with the session when its program ends, and offers to continue it', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(claude);
    h.reader.chats = [chat('abc-123', 1, 30)];
    h.ptyPort.spawned[0]?.pty.exit(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.sessions.get(id)?.meta['chat']).toBe('abc-123');
    expect(await h.chats.info(id, true)).toEqual({
      chat: { id: 'abc-123', title: 'chat abc-123', updatedAt: '2026-01-01T00:30:00.000Z' },
      native: true,
      canContinue: true,
    });
  });

  it('names each terminal by the first thing asked in its chat, reusing the answer for a moment', async () => {
    const h = createHarness();
    const mine = await h.sessions.create(claude);
    const shell = await h.sessions.create(customBody('/work'));
    h.reader.chats = [chat('abc', 1, 5)];
    const first = await h.chats.titles();
    expect(first).toEqual({ [mine.id]: 'chat abc' });
    expect(first[shell.id]).toBeUndefined();
    h.reader.chats = [];
    expect(await h.chats.titles()).toEqual(first);
  });

  it('has nothing to read for a CLI without chat support, but can still continue from the screen', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody('/work'));
    expect(await h.chats.current(id)).toBeNull();
    expect(await h.chats.info(id, true)).toEqual({ chat: null, native: false, canContinue: true });
    expect((await h.chats.info(id, false)).canContinue).toBe(false);
  });
});
