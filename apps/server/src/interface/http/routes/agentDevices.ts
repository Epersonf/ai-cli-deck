import { AGENT_PATH, EXEC_MAX_SECONDS } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../../domain/errors.js';
import { createDeviceTools } from '../../agent/deviceTools.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ sessionId: z.string().min(1) });
const Device = z.object({ device: z.string().min(1).max(80) });
const Terminal = Device.extend({ terminal: z.string().min(1).max(80) });
const RunBody = Device.extend({
  command: z.string().min(1).max(8000),
  cwd: z.string().max(1000).optional(),
  timeoutSec: z.number().int().min(1).max(EXEC_MAX_SECONDS).optional(),
});
const OpenBody = Device.extend({
  profile: z.string().min(1).max(80),
  cwd: z.string().max(1000).optional(),
  command: z.string().max(2000).optional(),
});
const SendBody = Terminal.extend({ text: z.string().max(20_000), enter: z.boolean().optional() });
const ReadQuery = Terminal.extend({ lines: z.coerce.number().int().min(1).max(500).optional() });

/** The paired devices for the `clideck device` command (loopback only, like every agent route). */
export async function agentDeviceRoutes(root: FastifyInstance, c: Container): Promise<void> {
  await root.register(async (app) => {
    // Only a terminal of this deck may ask.
    app.addHook('preHandler', async (request) => {
      const { sessionId } = parseWith(Params, request.params);
      if (!c.sessions.get(sessionId)) throw notFound(`Session ${sessionId}`);
    });
    routes(app, c);
  });
}

function routes(app: FastifyInstance, c: Container): void {
  const tools = createDeviceTools(c);
  const base = `${AGENT_PATH}/:sessionId/devices`;

  app.get(base, () => tools.devices());
  app.post(`${base}/run`, (request) => {
    const { device, command, cwd, timeoutSec } = parseWith(RunBody, request.body);
    return tools.run(device, command, cwd, timeoutSec);
  });
  app.get(`${base}/terminals`, (request) =>
    tools.terminals(parseWith(Device, request.query).device),
  );
  app.post(`${base}/open`, (request) => {
    const { device, profile, cwd, command } = parseWith(OpenBody, request.body);
    return tools.open(device, profile, cwd, command);
  });
  app.post(`${base}/send`, (request) => {
    const { device, terminal, text, enter } = parseWith(SendBody, request.body);
    return tools.send(device, terminal, text, enter);
  });
  app.get(`${base}/read`, (request) => {
    const { device, terminal, lines } = parseWith(ReadQuery, request.query);
    return tools.read(device, terminal, lines);
  });
  app.post(`${base}/close`, (request) => {
    const { device, terminal } = parseWith(Terminal, request.body);
    return tools.close(device, terminal);
  });
}
