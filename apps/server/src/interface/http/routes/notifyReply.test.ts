import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { ReplyLinks } from '../../../application/ReplyLinks.js';
import { agentBody, createHarness } from '../../../testing/harness.js';
import type { Container } from '../../container.js';
import { registerErrorHandler } from '../errors.js';
import { notifyReplyRoutes } from './notifyReply.js';

async function setup() {
  const h = createHarness();
  const { id } = await h.sessions.create(agentBody());
  const replyLinks = new ReplyLinks();
  const server = Fastify();
  registerErrorHandler(server);
  notifyReplyRoutes(server, { sessions: h.sessions, replyLinks } as unknown as Container);
  await server.ready();
  const post = (token: string, payload: unknown) =>
    server.inject({ method: 'POST', url: `/agent/reply/${token}`, payload: payload as object });
  return { h, id, replyLinks, post };
}

describe('replying from a notification', () => {
  it('sends the text to the chat behind the address', async () => {
    const { h, id, replyLinks, post } = await setup();
    const res = await post(replyLinks.issue(id), { text: '  go on  ' });
    expect(res.statusCode).toBe(200);
    expect(h.agent.last.sent.map((s) => s.text)).toEqual(['go on']);
  });

  it('queues the reply while the agent is still answering', async () => {
    const { h, id, replyLinks, post } = await setup();
    const token = replyLinks.issue(id);
    await post(token, { text: 'first' });
    await post(token, { text: 'second' });
    expect(h.agent.last.sent.map((s) => s.text)).toEqual(['first']);
    expect(h.sessions.queued(id).map((q) => q.text)).toEqual(['second']);
  });

  it('refuses unknown addresses, empty text and chats that are gone', async () => {
    const { h, id, replyLinks, post } = await setup();
    expect((await post('unknown-token', { text: 'x' })).statusCode).toBe(410);
    expect((await post(replyLinks.issue(id), { text: '   ' })).statusCode).toBe(400);
    const token = replyLinks.issue('ghost-session');
    expect((await post(token, { text: 'x' })).statusCode).toBe(410);
    expect(h.agent.runs).toHaveLength(0);
  });
});
