import { GitCommitBodySchema, GitPathBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });

/** The review pane: what changed in a session's repository, each file's diff, discard, commit and push. */
export function gitRoutes(app: FastifyInstance, c: Container): void {
  const id = (params: unknown): string => parseWith(IdParams, params).id;

  app.get('/api/sessions/:id/git/review', (request) => c.gitReview.review(id(request.params)));

  app.get('/api/sessions/:id/git/diff', (request) => {
    const { path } = parseWith(GitPathBodySchema, request.query);
    return c.gitReview.diff(id(request.params), path);
  });

  app.post('/api/sessions/:id/git/discard', async (request, reply) => {
    const { path } = parseWith(GitPathBodySchema, request.body);
    await c.gitReview.discard(id(request.params), path);
    return reply.code(204).send();
  });

  app.post('/api/sessions/:id/git/commit', async (request) => {
    const { message, paths } = parseWith(GitCommitBodySchema, request.body);
    return { output: await c.gitReview.commit(id(request.params), message, paths) };
  });

  app.post('/api/sessions/:id/git/push', async (request) => ({
    output: await c.gitReview.push(id(request.params)),
  }));
}
