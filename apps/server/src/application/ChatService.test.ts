import { describe, expect, it } from 'vitest';
import type { ChatEntry } from '../domain/chat.js';
import { agentBody, createHarness } from '../testing/harness.js';

const at = (minutes: number): Date => new Date(Date.UTC(2026, 0, 1, 0, minutes));
const chat = (id: string): ChatEntry => ({
  id,
  path: `/chats/${id}.jsonl`,
  title: `chat ${id}`,
  startedAt: at(0),
  updatedAt: at(5),
});

describe('the conversations a session knows', () => {
  it('lists the saved chats of a profile in a folder', async () => {
    const h = createHarness();
    h.reader.chats = [chat('a'), chat('b')];
    expect((await h.chats.list('claude', '/work')).map((c) => c.id)).toEqual(['a', 'b']);
    expect(await h.chats.list('nope', '/work')).toEqual([]);
  });

  it('says what a session can continue once its agent reported a chat', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    expect(await h.chats.info(id)).toMatchObject({ chat: null, native: false, canContinue: false });
    await h.sessions.send(id, 'hello there');
    h.agent.last.sink.chatId('abc-123');
    expect(await h.chats.info(id)).toMatchObject({
      chat: { id: 'abc-123', title: 'hello there' },
      native: true,
      canContinue: true,
    });
  });

  it('names each session by the first thing asked in it, reusing the answer for a moment', async () => {
    const h = createHarness();
    const mine = await h.sessions.create(agentBody());
    const quiet = await h.sessions.create(agentBody());
    await h.sessions.send(mine.id, 'fix the login bug');
    const first = await h.chats.titles();
    expect(first).toEqual({ [mine.id]: 'fix the login bug' });
    expect(first[quiet.id]).toBeUndefined();
    await h.sessions.send(quiet.id, 'later');
    expect(await h.chats.titles()).toEqual(first);
  });
});
