import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

/** A chat with two exchanges; the agent has saved it as `chat-1`. */
async function twoExchanges() {
  const h = createHarness();
  const { id } = await h.sessions.create(agentBody());
  await h.sessions.send(id, 'first');
  h.agent.last.sink.chatId('chat-1');
  h.agent.last.reply('one');
  await h.sessions.send(id, 'second');
  h.agent.last.reply('two');
  const events = (await h.sessions.snapshot(id)).events;
  const second = events.filter((e) => e.t === 'user')[1];
  return { h, id, second: second?.t === 'user' ? second.id : '' };
}

describe('editing a sent message', () => {
  it('gives each user step a uuid and sends it to the agent as the message id', async () => {
    const { h } = await twoExchanges();
    const ids = h.agent.last.sent.map((m) => m.id);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('resumes the saved chat at the point the agent names, and tells every device the kept chat', async () => {
    const { h, id, second } = await twoExchanges();
    h.agent.rewindTo = { resumeAt: 'entry-before' };
    h.events.length = 0;
    await h.sessions.rewind(id, { messageId: second, text: 'second, better', revertFiles: true });
    expect(h.agent.rewinds[0]).toMatchObject({ userId: second, revertFiles: true });
    const reset = h.events.find((e) => e.kind === 'reset');
    expect(reset?.kind === 'reset' && reset.events.map((e) => e.t)).toEqual([
      'user',
      'turn-start',
      'text',
      'turn-end',
    ]);
    expect(h.agent.last.sent.at(-1)?.text).toBe('second, better');
    h.agent.last.sink.ended();
    h.agent.last.reply('three');
    const types = (await h.sessions.snapshot(id)).events.map((e) => e.t);
    expect(types.filter((t) => t === 'user')).toHaveLength(2);
  });

  it('starts the next run at the resume point, only once', async () => {
    const { h, id, second } = await twoExchanges();
    h.agent.rewindTo = { resumeAt: 'entry-before' };
    h.agent.last.sink.ended();
    await h.sessions.rewind(id, { messageId: second, text: 'again' });
    expect(h.agent.last.spec).toMatchObject({
      resumeId: 'chat-1',
      resumeAt: 'entry-before',
      dropsTurn: second,
    });
    h.agent.last.reply('x');
    h.agent.last.sink.ended();
    await h.sessions.send(id, 'later');
    expect(h.agent.last.spec).toMatchObject({ resumeId: 'chat-1', resumeAt: null });
  });

  it('starts a new thread that replays the kept turns when the agent cannot go back', async () => {
    const { h, id, second } = await twoExchanges();
    h.agent.rewindTo = { resumeAt: null };
    await h.sessions.rewind(id, { messageId: second, text: 'second, better' });
    const sent = h.agent.last.sent.at(-1)?.text ?? '';
    expect(sent).toContain('## User\n\nfirst');
    expect(sent).toContain('## Assistant\n\none');
    expect(sent.endsWith('second, better')).toBe(true);
    expect(sent).not.toContain('## User\n\nsecond');
    expect(h.agent.last.spec.resumeId).toBeNull();
    expect(h.sessions.get(id)?.meta['chat']).toBeUndefined();
    const shown = (await h.sessions.snapshot(id)).events.filter((e) => e.t === 'user');
    expect(shown.map((e) => (e.t === 'user' ? e.text : ''))).toEqual(['first', 'second, better']);
  });

  it('editing the first message starts the conversation over with just the new text', async () => {
    const { h, id } = await twoExchanges();
    const first = (await h.sessions.snapshot(id)).events.find((e) => e.t === 'user');
    h.agent.rewindTo = { resumeAt: 'whatever' };
    await h.sessions.rewind(id, { messageId: first?.t === 'user' ? first.id : '', text: 'new' });
    expect(h.agent.last.sent.at(-1)?.text).toBe('new');
    expect(h.agent.last.spec.resumeId).toBeNull();
  });

  it('refuses while an answer is being written, when the message is unknown, or the files cannot be restored', async () => {
    const { h, id, second } = await twoExchanges();
    await h.sessions.send(id, 'busy now');
    await expect(h.sessions.rewind(id, { messageId: second, text: 'x' })).rejects.toThrow(/Stop/);
    h.agent.last.reply('done');
    await expect(h.sessions.rewind(id, { messageId: 'nope', text: 'x' })).rejects.toThrow(
      /not found/,
    );
    h.agent.rewindTo = { resumeAt: null, error: 'No checkpoint' };
    const before = (await h.sessions.snapshot(id)).events.length;
    await expect(
      h.sessions.rewind(id, { messageId: second, text: 'x', revertFiles: true }),
    ).rejects.toThrow('No checkpoint');
    expect((await h.sessions.snapshot(id)).events).toHaveLength(before);
  });

  it('ends background jobs that were still shown running in the kept part', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'serve it');
    h.agent.last.sink.event({ t: 'task', id: 'b1', title: 'npm run dev', state: 'running' });
    h.agent.last.reply('started');
    await h.sessions.send(id, 'second');
    const second = (await h.sessions.snapshot(id)).events.filter((e) => e.t === 'user')[1];
    h.agent.last.reply('ok');
    await h.sessions.rewind(id, { messageId: second?.t === 'user' ? second.id : '', text: 'b' });
    const kept: ChatEvent[] = (await h.sessions.snapshot(id)).events;
    expect(kept.filter((e) => e.t === 'task').at(-1)).toMatchObject({ state: 'stopped' });
  });
});
