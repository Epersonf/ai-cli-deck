import type { FastifyInstance } from 'fastify';

/** Placeholder until milestone 5 wires the per-session MCP endpoint. */
export function mcpRoutes(app: FastifyInstance): void {
  app.all('/mcp/:sessionId', (_request, reply) =>
    reply.code(501).send({ error: 'MCP endpoint not implemented yet' }),
  );
}
