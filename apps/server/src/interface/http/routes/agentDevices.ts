import { AGENT_PATH } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../../domain/errors.js';
import { DeviceActionSchema, runDeviceAction } from '../../agent/deviceActions.js';
import { createDeviceTools } from '../../agent/deviceTools.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ sessionId: z.string().min(1) });

/**
 * Devices for `clideck devices` / `clideck device ...` (loopback only, like every agent route): one
 * endpoint taking the same actions as the MCP tool `device`.
 */
export function agentDeviceRoutes(app: FastifyInstance, c: Container): void {
  const tools = createDeviceTools(c);
  const sessionOf = (params: unknown) => {
    const { sessionId } = parseWith(Params, params);
    const session = c.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    return session;
  };

  app.post(`${AGENT_PATH}/:sessionId/devices`, async (request) => {
    const session = sessionOf(request.params);
    return runDeviceAction(tools, parseWith(DeviceActionSchema, request.body), session.cwd);
  });
}
