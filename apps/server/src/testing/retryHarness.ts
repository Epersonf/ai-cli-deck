import { agentBody, createHarness } from './harness.js';

export async function limited(provider = 'claude') {
  const h = createHarness();
  const { id } = await h.sessions.create({ ...agentBody(), provider });
  await h.sessions.send(id, 'complete the task');
  h.agent.last.sink.chatId('saved-thread');
  h.agent.last.sink.event({ t: 'text', id: 'progress', text: 'Started working on the task.' });
  h.agent.last.sink.event({
    t: 'turn-end',
    error: '429 rate limit exceeded',
    costUsd: null,
    durationMs: null,
  });
  const state = (await h.sessions.settings(id)).retry;
  if (!state) throw new Error('Missing retry choice');
  return { h, id, state };
}
