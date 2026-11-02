import { AGENT_PATH } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAgentTools } from '../../agent/agentTools.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ sessionId: z.string().min(1) });
const RequestParams = Params.extend({ requestId: z.string().min(1) });
const UrlBody = z.object({ url: z.string().min(1) });
const ReasonBody = z.object({ reason: z.string().min(1).max(500) });

/** HTTP face of the agent tools, used by the `clideck` command. Loopback only. */
export function agentRoutes(app: FastifyInstance, c: Container): void {
  const tools = (params: unknown) => createAgentTools(c, parseWith(Params, params).sessionId);
  const base = `${AGENT_PATH}/:sessionId`;

  app.get(`${base}/whoami`, (request) => tools(request.params).whoami());
  app.get(`${base}/sessions`, (request) => tools(request.params).listSessions());
  app.post(`${base}/preview`, (request) =>
    tools(request.params).openPreview(parseWith(UrlBody, request.body).url),
  );
  app.post(`${base}/newtab`, (request) =>
    tools(request.params).suggestNewTab(parseWith(UrlBody, request.body).url),
  );
  app.post(`${base}/worktree`, (request) =>
    tools(request.params).proposeWorktree(parseWith(ReasonBody, request.body).reason),
  );
  app.get(`${base}/requests/:requestId`, (request) => {
    const { requestId } = parseWith(RequestParams, request.params);
    return tools(request.params).requestStatus(requestId);
  });
}
