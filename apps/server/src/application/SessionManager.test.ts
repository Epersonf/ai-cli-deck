import { describe, expect, it } from 'vitest';
import { FakeChatLog } from '../testing/fakeAgent.js';
import { agentBody, createHarness } from '../testing/harness.js';

describe('a chat session', () => {
  it('starts idle with no agent running, and the agent starts on the first message', async () => {
    const h = createHarness();
    const session = await h.sessions.create(agentBody());
    expect(session).toMatchObject({ status: 'idle', provider: 'claude', cwd: '/work' });
    expect(h.agent.runs).toHaveLength(0);
    await h.sessions.send(session.id, 'hello');
    expect(h.agent.last.sent[0]?.text).toBe('hello');
    expect(h.agent.last.spec).toMatchObject({ cwd: '/work', mode: 'default', resumeId: null });
    expect(h.agent.last.spec.env).toMatchObject({
      DECK_SESSION_ID: session.id,
      DECK_URL: 'http://127.0.0.1:7842',
      PORT: String(session.port),
    });
    expect(h.agent.last.spec.mcpUrl).toBe(`http://127.0.0.1:7842/mcp/${session.id}`);
  });

  it('is working while the agent answers, then idle, and keeps the conversation', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    expect(h.sessions.get(id)?.status).toBe('working');
    h.agent.last.reply('hello back');
    expect(h.sessions.get(id)?.status).toBe('idle');
    const { events, busy } = await h.sessions.snapshot(id);
    expect(busy).toBe(false);
    expect(events.map((e) => e.t)).toEqual(['user', 'turn-start', 'text', 'turn-end']);
    expect(h.sessions.lastAnswer(id)).toBe('hello back');
  });

  it('queues a message sent while the agent is answering and sends it after', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'one');
    await h.sessions.send(id, 'two');
    expect(h.agent.last.sent.map((m) => m.text)).toEqual(['one']);
    h.agent.last.reply('ok');
    expect(h.agent.last.sent.map((m) => m.text)).toEqual(['one', 'two']);
  });

  it('keeps the conversation id and the settings with the session, and resumes after the run ends', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    h.agent.last.sink.chatId('chat-1');
    h.sessions.configure(id, { model: 'opus', mode: 'plan' });
    expect(h.agent.last.configs).toEqual([{ model: 'opus', mode: 'plan' }]);
    h.agent.last.reply('ok');
    h.agent.last.sink.ended();
    await h.sessions.send(id, 'again');
    expect(h.agent.runs).toHaveLength(2);
    expect(h.agent.last.spec).toMatchObject({
      resumeId: 'chat-1',
      model: 'opus',
      mode: 'plan',
      fork: false,
    });
    expect(h.sessions.get(id)?.meta).toMatchObject({ chat: 'chat-1', model: 'opus', mode: 'plan' });
  });

  it('shows the text being written and replaces it when the finished step arrives', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    h.agent.last.sink.delta('m:0', 'text', 'Hel');
    h.agent.last.sink.delta('m:0', 'text', 'lo');
    expect((await h.sessions.snapshot(id)).partials).toEqual([
      { id: 'm:0', kind: 'text', text: 'Hello' },
    ]);
    h.agent.last.sink.event({ t: 'text', id: 'm:0', text: 'Hello!' });
    expect((await h.sessions.snapshot(id)).partials).toEqual([]);
  });

  it('turns a failing start into an error in the chat instead of throwing', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    h.agent.failWith = new Error('not signed in');
    await h.sessions.send(id, 'hi');
    const last = (await h.sessions.snapshot(id)).events.at(-1);
    expect(last).toMatchObject({ t: 'turn-end', error: 'AUTH: not signed in' });
    expect(h.sessions.get(id)?.status).toBe('idle');
  });

  it('stops the answer, forwards permission answers and drops what was queued', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'one');
    await h.sessions.send(id, 'two');
    h.sessions.interrupt(id);
    expect(h.agent.last.interrupted).toBe(1);
    h.agent.last.sink.event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
    expect(h.agent.last.sent).toHaveLength(1);
    h.sessions.answer(id, 'p1', { allow: true });
    expect(h.agent.last.answers).toEqual([['p1', { allow: true }]]);
  });

  it('brings sessions back after a restart with their conversation, closing what was half done', async () => {
    const log = new FakeChatLog();
    const first = createHarness({ log });
    const { id } = await first.sessions.create(agentBody());
    await first.sessions.send(id, 'hi');
    first.agent.last.sink.event({
      t: 'permission',
      id: 'p',
      tool: 'Bash',
      input: {},
      canAlways: false,
      reason: null,
    });
    await first.sessions.snapshot(id);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = createHarness({ log, stored: first.store.saved });
    await second.sessions.restore();
    expect(second.sessions.get(id)?.status).toBe('idle');
    const events = (await second.sessions.snapshot(id)).events;
    expect(events.map((e) => e.t)).toEqual([
      'user',
      'turn-start',
      'permission',
      'permission-done',
      'turn-end',
    ]);
    expect(events.at(-1)).toMatchObject({
      t: 'turn-end',
      error: expect.stringContaining('restarted'),
    });
  });

  it('removes a session with its conversation and frees its port', async () => {
    const h = createHarness();
    const { id, port } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    await h.sessions.remove(id);
    expect(h.sessions.get(id)).toBeUndefined();
    expect(h.agent.last.closed).toBe(true);
    expect(h.log.logs.has(id)).toBe(false);
    expect((await h.sessions.create(agentBody())).port).toBe(port);
  });

  it('rejects a folder that does not exist', async () => {
    const h = createHarness();
    await expect(h.sessions.create(agentBody('/nope'))).rejects.toThrow(/Not a directory/);
  });
});
