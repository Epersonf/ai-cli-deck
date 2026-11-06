import { ProfileBundleSchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const PackQuery = z.object({ chats: z.enum(['0', '1']).default('0') });
/** A packed profile is its config folder in base64: larger than the API's usual 1 MB. */
const BUNDLE_LIMIT = 100 << 20;

/** Moving a profile (its sign-in, key and settings) between devices: pack it here, unpack it there. */
export function profileBundleRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/profiles/:id/bundle', (request) => {
    const { id } = parseWith(IdParams, request.params);
    return c.profileBundles.pack(id, parseWith(PackQuery, request.query).chats === '1');
  });

  app.post('/api/profiles/import', { bodyLimit: BUNDLE_LIMIT }, async (request, reply) => {
    const bundle = parseWith(ProfileBundleSchema, request.body);
    return reply.code(201).send(await c.profileBundles.unpack(bundle));
  });
}
