import { PREVIEW_TABS_MAX } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const Body = z.object({ tabs: z.array(z.number().int()).max(PREVIEW_TABS_MAX) });

/** The browser tabs a session has open, shared by every device that shows it. */
export function browserTabsRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/sessions/:id/browser-tabs', (request) => ({
    tabs: c.browserTabs?.get(parseWith(IdParams, request.params).id) ?? null,
  }));
  app.put('/api/sessions/:id/browser-tabs', (request) => ({
    tabs: c.browserTabs?.set(
      parseWith(IdParams, request.params).id,
      parseWith(Body, request.body).tabs,
    ),
  }));
}
