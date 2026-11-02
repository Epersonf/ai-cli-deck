import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { mcpRoutes } from '../mcp/mcpRoute.js';
import { terminalSocket } from '../ws/terminalSocket.js';
import { registerErrorHandler } from './errors.js';
import { agentRoutes } from './routes/agent.js';
import { approvalRoutes } from './routes/approvals.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { rawRoutes } from './routes/raw.js';
import { workspaceRoutes } from './routes/workspace.js';
import { registerSecurity } from './security.js';

async function serveStatic(app: FastifyInstance, dir: string): Promise<void> {
  await app.register(fastifyStatic, { root: dir, wildcard: false });
  const index = join(dir, 'index.html');
  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url.startsWith('/api') || request.url.startsWith('/ws');
    if (isApi || request.method !== 'GET') return reply.code(404).send({ error: 'Not found' });
    return reply.sendFile(existsSync(index) ? 'index.html' : '');
  });
}

export async function createApp(c: Container): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: 'info', redact: ['req.headers.authorization'] } });
  registerErrorHandler(app);
  registerSecurity(app, c.security);
  await app.register(fastifyWebsocket);
  authRoutes(app, c);
  sessionRoutes(app, c);
  workspaceRoutes(app, c);
  rawRoutes(app, c);
  approvalRoutes(app, c);
  mcpRoutes(app, c);
  agentRoutes(app, c);
  terminalSocket(app, c);
  if (c.staticDir !== null && existsSync(c.staticDir)) await serveStatic(app, c.staticDir);
  return app;
}
