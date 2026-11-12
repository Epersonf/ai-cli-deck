import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

const later = new Date(Date.UTC(2026, 0, 1, 0, 30));
const theChat = {
  id: 'abc-123',
  path: '/chats/abc-123.jsonl',
  title: 'fix the login bug',
  startedAt: later,
  updatedAt: later,
};

/** A Claude session that had a conversation (its agent reported a chat id). */
async function talked() {
  const h = createHarness();
  const { id } = await h.sessions.create(agentBody());
  await h.sessions.send(id, 'fix the login bug');
  h.agent.last.sink.chatId('abc-123');
  h.agent.last.sink.event({ t: 'tool', id: 't1', name: 'Bash', input: { command: 'npm test' } });
  h.agent.last.reply('Fixed: the token was not refreshed.');
  h.reader.chats = [theChat];
  h.reader.turns.set('abc-123', [
    { role: 'user', text: 'fix the login bug' },
    { role: 'assistant', text: 'Fixed.' },
  ]);
  return { h, id };
}

describe('continuing a conversation', () => {
  it('starts the conversation over in the same session when asked for a new one', async () => {
    const { h, id } = await talked();
    await h.chatActions.restart(id, { mode: 'new' });
    const snapshot = await h.sessions.snapshot(id);
    expect(snapshot.events).toEqual([]);
    expect(h.sessions.get(id)?.meta['chat']).toBeUndefined();
  });

  it('moves the conversation to another AI as a transcript it is asked to read', async () => {
    const { h, id } = await talked();
    await h.chatActions.restart(id, { mode: 'continue', provider: 'codex' });
    expect(h.sessions.get(id)?.provider).toBe('codex');
    const [file, text] = [...h.chatFiles.transcripts.entries()][0] ?? [];
    expect(file).toMatch(/^\/work\/\.deck\/chats\/.+\.md$/);
    expect(text).toContain('## User\n\nfix the login bug');
    expect(text).toContain('→ Bash: npm test');
    const first = h.agent.last.sent[0]?.text ?? '';
    expect(first).toMatch(
      /^\[deck\] This chat continues a conversation the user had with Claude Code/,
    );
    expect(first).toContain('.deck/chats/');
    expect(h.agent.last.spec.kind).toBe('codex');
  });

  it('forks natively in the same agent (resuming a copy), and hands over to another', async () => {
    const { h, id } = await talked();
    const copy = await h.chatActions.fork(id, {});
    await h.sessions.send(copy.id, 'and now?');
    expect(h.agent.last.spec).toMatchObject({ resumeId: 'abc-123', fork: true });
    expect((await h.sessions.snapshot(copy.id)).events.some((e) => e.t === 'user')).toBe(true);
    await h.chatActions.fork(id, { provider: 'codex' });
    expect(h.agent.last.sent[0]?.text).toContain('[deck] This chat continues');
  });

  it('opens a saved chat in a new session showing its turns, and nothing that is not one', async () => {
    const { h } = await talked();
    const opened = await h.chatActions.open({
      provider: 'claude',
      cwd: '/work',
      chatId: 'abc-123',
    });
    expect(h.sessions.get(opened.id)?.meta['chat']).toBe('abc-123');
    const events = (await h.sessions.snapshot(opened.id)).events;
    expect(events.map((e) => e.t)).toEqual(['user', 'text']);
    await h.sessions.send(opened.id, 'continue');
    expect(h.agent.last.spec.resumeId).toBe('abc-123');
    const missing = { provider: 'claude', cwd: '/work', chatId: 'nope' };
    await expect(h.chatActions.open(missing)).rejects.toThrow(/not found/i);
  });

  it('refuses to hand over a conversation that has not started', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await expect(
      h.chatActions.restart(id, { mode: 'continue', provider: 'codex' }),
    ).rejects.toThrow(/no conversation/);
  });
});
