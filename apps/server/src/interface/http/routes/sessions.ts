import {
  CreateProfileBodySchema,
  CreateSessionBodySchema,
  RenameProfileBodySchema,
  RenameSessionBodySchema,
  SetProfileSecretBodySchema,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { removeProfile } from '../../../application/removeProfile.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const ForceQuery = z.object({ force: z.enum(['0', '1']).optional() });
const PreviewBody = z.object({ url: z.string().min(1) });

export function sessionRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/config', () => c.publicConfig);

  app.get('/api/providers', () =>
    Promise.all(
      c.providers.list().map(async (provider) => ({
        id: provider.id,
        label: provider.label,
        profile: c.profiles.has(provider.id),
        agent: provider.agent,
        keyState: provider.keyState?.() ?? 'none',
        signIn: provider.signIn ?? 'account',
        ...(provider.authentication
          ? {
              authMethods: provider.authentication.methods.filter(
                (method) => method.flow !== 'key' || c.profiles.has(provider.id),
              ),
            }
          : {}),
        ...(await c.providerStatus(provider.id)),
      })),
    ),
  );

  app.get('/api/sessions', () => c.sessions.list());

  app.post('/api/sessions', async (request, reply) => {
    const body = parseWith(CreateSessionBodySchema, request.body);
    // parentId is only ever set by the server (side chats).
    return reply.code(201).send(await c.sessions.create({ ...body, parentId: null }));
  });

  app.delete('/api/sessions/:id', async (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    await c.sessions.remove(id);
    return reply.code(204).send();
  });

  app.patch('/api/sessions/:id', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { name } = parseWith(RenameSessionBodySchema, request.body);
    return c.sessions.rename(id, name);
  });

  app.post('/api/profiles', async (request, reply) => {
    const body = parseWith(CreateProfileBodySchema, request.body);
    return reply.code(201).send(await c.profiles.create(body));
  });

  app.delete('/api/profiles/:id', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { force } = parseWith(ForceQuery, request.query);
    return removeProfile(c, id, force === '1');
  });

  // Replaces the profile's API key (never read back: only its state is shown).
  app.put('/api/profiles/:id/secret', async (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    const { secret } = parseWith(SetProfileSecretBodySchema, request.body);
    await c.profiles.setSecret(id, secret);
    c.catalog.invalidate(id); // the endpoint may list other models with the new key
    void c.catalog.refresh(id);
    return reply.code(204).send();
  });

  app.patch('/api/profiles/:id', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { label } = parseWith(RenameProfileBodySchema, request.body);
    return c.profiles.rename(id, label);
  });

  // The person bases the session in another folder (the Files panel's "use this folder").
  app.put('/api/sessions/:id/cwd', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { path } = parseWith(z.object({ path: z.string().min(1).max(1024) }), request.body);
    return c.sessions.setCwd(id, path);
  });

  app.put('/api/sessions/:id/preview', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { url } = parseWith(PreviewBody, request.body);
    return { url: c.sessions.setPreview(id, url) };
  });
}
