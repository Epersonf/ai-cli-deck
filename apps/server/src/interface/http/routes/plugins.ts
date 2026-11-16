import { PluginPackageBodySchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { invalid, notFound } from '../../../domain/errors.js';
import { inspectPluginArchive } from '../../../infrastructure/plugins/archive.js';
import {
  exportPlugin,
  installPlugin,
  removePlugin,
  testPlugin,
} from '../../../infrastructure/plugins/packages.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/) });
/** Inspect metadata separately from importing code. All imports require the UI's explicit confirmation. */
export function pluginRoutes(app: FastifyInstance, c: Container): void {
  const plugins = c.providerPlugins;
  if (!plugins) return;
  const inUse = (id: string): boolean => c.profiles.usesTemplate(id);
  app.post('/api/plugins/inspect', { bodyLimit: 12 << 20 }, (request) => {
    const { data } = parseWith(PluginPackageBodySchema, request.body);
    try {
      return inspectPluginArchive(Buffer.from(data, 'base64')).manifest;
    } catch (error) {
      throw invalid(error instanceof Error ? error.message : 'Invalid plugin package');
    }
  });
  app.post('/api/plugins', { bodyLimit: 12 << 20 }, async (request, reply) => {
    const { data } = parseWith(PluginPackageBodySchema, request.body);
    try {
      const id = await installPlugin(plugins, Buffer.from(data, 'base64'), inUse);
      return reply.code(201).send(c.templates.list().find((template) => template.id === id));
    } catch (error) {
      throw invalid(error instanceof Error ? error.message : 'Plugin import failed');
    }
  });
  app.get('/api/plugins/:id/package', async (request, reply) => {
    const result = await exportPlugin(plugins, parseWith(Params, request.params).id);
    return reply
      .header('content-disposition', `attachment; filename="${result.name}"`)
      .type('application/zip')
      .send(Buffer.from(result.data, 'base64'));
  });
  app.get('/api/plugins/:id/export', (request) =>
    exportPlugin(plugins, parseWith(Params, request.params).id),
  );
  app.post('/api/plugins/:id/test', (request) =>
    testPlugin(plugins, parseWith(Params, request.params).id),
  );
  app.delete('/api/plugins/:id', async (request, reply) => {
    const id = parseWith(Params, request.params).id;
    if (!plugins.get(id)) throw notFound(`Plugin ${id}`);
    await removePlugin(plugins, id, inUse);
    return reply.code(204).send();
  });
}
