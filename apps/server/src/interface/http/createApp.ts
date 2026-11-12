import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Container } from '../container.js';
import { mcpRoutes } from '../mcp/mcpRoute.js';
import { browserSocket } from '../ws/browserSocket.js';
import { browserTabsRoutes } from './routes/browserTabs.js';
import { notifyActionRoutes } from './routes/notifyAction.js';
import { eventsSocket } from '../ws/eventsSocket.js';
import { chatSocket } from '../ws/chatSocket.js';
import { browserRoutes } from './routes/browser.js';
import { registerErrorHandler } from './errors.js';
import { agentRoutes } from './routes/agent.js';
import { agentDeviceRoutes } from './routes/agentDevices.js';
import { approvalRoutes } from './routes/approvals.js';
import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chats.js';
import { gitRoutes } from './routes/git.js';
import { installRoutes } from './routes/install.js';
import { machineRoutes } from './routes/machine.js';
import { fileRoutes } from './routes/files.js';
import { profileBundleRoutes } from './routes/profileBundles.js';
import { networkRoutes } from './routes/network.js';
import { peerProxyRoutes } from './routes/peerProxy.js';
import { memoryRoutes } from './routes/memory.js';
import { agentMemoryRoutes } from './routes/agentMemory.js';
import { modelRoutes } from './routes/models.js';
import { taskRoutes } from './routes/tasks.js';
import { templateRoutes } from './routes/templates.js';
import { fsDirRoutes } from './routes/fsDirs.js';
import { signInRoutes } from './routes/signin.js';
import { sessionRoutes } from './routes/sessions.js';
import { rawRoutes } from './routes/raw.js';
import { uploadRoutes } from './routes/upload.js';
import { voiceRoutes } from './routes/voice.js';
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

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error'];

/** `DECK_LOG_LEVEL=debug` turns on verbose server logs (the Android app does it from its Settings). */
function logLevel(): string {
  const wanted = process.env['DECK_LOG_LEVEL'] ?? '';
  return LEVELS.includes(wanted) ? wanted : 'info';
}

export async function createApp(c: Container): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: logLevel(), redact: ['req.headers.authorization'] } });
  registerErrorHandler(app);
  registerSecurity(app, c.security);
  await app.register(fastifyWebsocket);
  authRoutes(app, c);
  sessionRoutes(app, c);
  chatRoutes(app, c);
  installRoutes(app, c);
  signInRoutes(app, c);
  fsDirRoutes(app);
  templateRoutes(app, c);
  taskRoutes(app, c);
  modelRoutes(app, c);
  memoryRoutes(app, c);
  workspaceRoutes(app, c);
  gitRoutes(app, c);
  rawRoutes(app, c);
  uploadRoutes(app, c);
  voiceRoutes(app, c);
  approvalRoutes(app, c);
  notifyActionRoutes(app, c);
  mcpRoutes(app, c);
  agentRoutes(app, c);
  agentMemoryRoutes(app, c);
  agentDeviceRoutes(app, c);
  browserRoutes(app, c);
  browserTabsRoutes(app, c);
  networkRoutes(app, c);
  machineRoutes(app, c);
  fileRoutes(app);
  profileBundleRoutes(app, c);
  await peerProxyRoutes(app, c);
  eventsSocket(app, c);
  chatSocket(app, c);
  browserSocket(app, c);
  if (c.staticDir !== null && existsSync(c.staticDir)) await serveStatic(app, c.staticDir);
  return app;
}
