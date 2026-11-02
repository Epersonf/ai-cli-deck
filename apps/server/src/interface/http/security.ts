import { MCP_PATH, TOKEN_HEADER, TOKEN_QUERY } from '@deck/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { isLoopbackHost } from '../../infrastructure/config/bind.js';
import type { SecurityOptions } from '../container.js';
import {
  isAllowedHost,
  isAllowedOrigin,
  isLoopbackAddress,
  isLoopbackHostname,
  hostnameOf,
} from './guards.js';

const PROTECTED_PREFIXES = ['/api', '/ws'];
/** Reachable without a token (still origin/host checked): the login handshake itself. */
const PUBLIC_PATHS = new Set(['/api/login', '/api/auth']);

function readToken(request: FastifyRequest): string | undefined {
  const header = request.headers[TOKEN_HEADER];
  if (typeof header === 'string') return header;
  const query = request.query as Record<string, unknown> | undefined;
  const fromQuery = query?.[TOKEN_QUERY];
  return typeof fromQuery === 'string' ? fromQuery : undefined;
}

export function registerSecurity(app: FastifyInstance, options: SecurityOptions): void {
  const loopbackBind = isLoopbackHost(options.bindHost);
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;
    if (url.startsWith(MCP_PATH)) {
      const hostOk = isLoopbackHostname(hostnameOf(request.headers.host));
      if (isLoopbackAddress(request.ip) && hostOk) return;
      return reply.code(403).send({ error: 'MCP is reachable from localhost only' });
    }
    if (!PROTECTED_PREFIXES.some((prefix) => url.startsWith(prefix))) return;
    const { host, origin } = request.headers;
    if (
      !isAllowedHost(host, loopbackBind) ||
      !isAllowedOrigin(origin, host, options.allowedOrigins)
    ) {
      return reply.code(403).send({ error: 'Origin or host not allowed' });
    }
    if (PUBLIC_PATHS.has(url.split('?')[0] ?? url)) return;
    if (!options.isValidToken(readToken(request))) {
      return reply.code(401).send({ error: 'Missing or invalid access token' });
    }
  });
}
