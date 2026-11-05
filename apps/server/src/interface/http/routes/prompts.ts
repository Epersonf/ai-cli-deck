import { DEFAULT_PROMPTS, QuickPromptsSchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

/** The quick prompts, one list for every device. */
export function promptRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/prompts', async () => ({ prompts: (await c.prompts.load()) ?? DEFAULT_PROMPTS }));

  app.put('/api/prompts', async (request) => {
    const { prompts } = parseWith(QuickPromptsSchema, request.body);
    await c.prompts.save(prompts);
    return { prompts };
  });
}
