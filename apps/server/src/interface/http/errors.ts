import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { DeckError, invalid } from '../../domain/errors.js';

export function parseWith<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw invalid(`Invalid request: ${detail}`);
  }
  return result.data;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DeckError) {
      return reply.code(error.httpStatus).send({ error: error.message });
    }
    // Fastify's own refusals (a body too large, bad JSON...) keep their 4xx status.
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return reply.code(status).send({ error: (error as Error).message });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: 'Internal server error' });
  });
}
