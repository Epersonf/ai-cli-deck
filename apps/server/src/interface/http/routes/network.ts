import {
  NetworkSettingsBodySchema,
  PairCodeBodySchema,
  PairStartBodySchema,
  PeerAddressBodySchema,
} from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1).max(80) });

/** Sharing this deck, finding and pairing other decks, and the requests to pair with this one. */
export function networkRoutes(app: FastifyInstance, c: Container): void {
  const idOf = (params: unknown): string => parseWith(IdParams, params).id;
  const { network, pairing, pairingRequests } = c;

  app.get('/api/network', () => network.status());
  app.patch('/api/network', (request) =>
    network.update(parseWith(NetworkSettingsBodySchema, request.body ?? {})),
  );

  app.get('/api/network/peers', () => network.peers());
  app.delete('/api/network/peers/:id', async (request, reply) => {
    await network.forget(idOf(request.params));
    return reply.code(204).send();
  });
  app.post('/api/network/peers/:id/addresses', async (request, reply) => {
    const { address } = parseWith(PeerAddressBodySchema, request.body);
    await network.addAddress(idOf(request.params), address);
    return reply.code(204).send();
  });

  app.get('/api/network/nearby', () => network.nearby());

  app.post('/api/network/pair', (request) =>
    pairing.start(parseWith(PairStartBodySchema, request.body).address),
  );
  app.post('/api/network/pair/:id', (request) =>
    pairing.submit(idOf(request.params), parseWith(PairCodeBodySchema, request.body).code),
  );
  app.delete('/api/network/pair/:id', (request, reply) => {
    pairing.cancel(idOf(request.params));
    return reply.code(204).send();
  });

  app.get('/api/network/requests', () => pairingRequests.list());
  app.delete('/api/network/requests/:id', (request, reply) => {
    pairingRequests.refuse(idOf(request.params));
    return reply.code(204).send();
  });
}
