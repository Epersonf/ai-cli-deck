import { MCP_PATH } from '@deck/shared';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../domain/errors.js';
import { createAgentTools } from '../agent/agentTools.js';
import { createDeviceTools } from '../agent/deviceTools.js';
import type { Container } from '../container.js';
import { parseWith } from '../http/errors.js';
import { buildMcpServer } from './mcpServer.js';

const Params = z.object({ sessionId: z.string().min(1) });
const NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed: use POST' },
  id: null,
};

/** Stateless Streamable HTTP MCP endpoint: `/mcp/<sessionId>` (loopback only, see security hook). */
export function mcpRoutes(app: FastifyInstance, c: Container): void {
  app.post(`${MCP_PATH}/:sessionId`, async (request, reply) => {
    const { sessionId } = parseWith(Params, request.params);
    const session = c.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    // Always offered: "here" lets an agent manage this deck's terminals, tasks and files too.
    const devices = { tools: createDeviceTools(c), cwd: session.cwd };
    const compact = c.providers.get(session.provider)?.compactTools === true;
    const server = buildMcpServer(createAgentTools(c, sessionId), devices, compact);
    const transport = new StreamableHTTPServerTransport({});
    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  const notAllowed = (
    _request: unknown,
    reply: { code(n: number): { send(b: unknown): unknown } },
  ) => reply.code(405).send(NOT_ALLOWED);
  app.get(`${MCP_PATH}/:sessionId`, notAllowed);
  app.delete(`${MCP_PATH}/:sessionId`, notAllowed);
}
