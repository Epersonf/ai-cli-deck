import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const NavigateBody = z.object({ url: z.string().min(1).max(2048) });
const InputBody = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('click'),
    x: z.number().min(0).max(5000),
    y: z.number().min(0).max(5000),
  }),
  z.object({ kind: z.literal('type'), text: z.string().min(1).max(2000) }),
  z.object({ kind: z.literal('key'), key: z.string().min(1).max(40) }),
  z.object({ kind: z.literal('scroll'), dy: z.number().min(-5000).max(5000) }),
  z.object({ kind: z.enum(['back', 'forward', 'reload']) }),
]);

/** The deck's own browser pane: status/install, navigate, screenshot, and user input. */
export function browserRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/browser', () => c.browser.status());
  app.post('/api/browser/install', () => c.browser.install());

  app.get('/api/sessions/:id/browser', async (request) =>
    c.browser.state(parseWith(IdParams, request.params).id),
  );
  app.post('/api/sessions/:id/browser/navigate', async (request) =>
    c.browser.navigate(
      parseWith(IdParams, request.params).id,
      parseWith(NavigateBody, request.body).url,
    ),
  );
  app.post('/api/sessions/:id/browser/input', async (request) =>
    c.browser.input(parseWith(IdParams, request.params).id, parseWith(InputBody, request.body)),
  );
  app.get('/api/sessions/:id/browser/diagnose', async (request) =>
    c.browser.diagnose(parseWith(IdParams, request.params).id),
  );
  app.get('/api/sessions/:id/browser/screenshot', async (request, reply) => {
    const image = await c.browser.screenshot(parseWith(IdParams, request.params).id);
    return reply
      .header('content-type', 'image/jpeg')
      .header('cache-control', 'no-store')
      .send(image);
  });
}
