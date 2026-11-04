import { AGENT_PATH } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAgentTools } from '../../agent/agentTools.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ sessionId: z.string().min(1) });
const RequestParams = Params.extend({ requestId: z.string().min(1) });
const UrlBody = z.object({ url: z.string().min(1) });
const TitleBody = z.object({ title: z.string().max(200) });
const MetaQuery = z.object({ key: z.string().min(1).optional() });
const MetaBody = z.object({ key: z.string().min(1), value: z.string() });
const HandoffBody = z.object({ text: z.string() });
const ReasonBody = z.object({ reason: z.string().min(1).max(500) });

/** HTTP face of the agent tools, used by the `clideck` command. Loopback only. */
export function agentRoutes(app: FastifyInstance, c: Container): void {
  const tools = (params: unknown) => createAgentTools(c, parseWith(Params, params).sessionId);
  const base = `${AGENT_PATH}/:sessionId`;

  app.get(`${base}/whoami`, (request) => tools(request.params).whoami());
  app.get(`${base}/sessions`, (request) => tools(request.params).listSessions());
  app.get(`${base}/title`, (request) => tools(request.params).title());
  app.post(`${base}/title`, (request) =>
    tools(request.params).title(parseWith(TitleBody, request.body).title),
  );
  app.get(`${base}/meta`, (request) => {
    const { key } = parseWith(MetaQuery, request.query);
    return tools(request.params).meta(key);
  });
  app.put(`${base}/meta`, (request) => {
    const { key, value } = parseWith(MetaBody, request.body);
    return tools(request.params).meta(key, value);
  });
  app.get(`${base}/handoff`, (request) => tools(request.params).handoff());
  app.put(`${base}/handoff`, (request) =>
    tools(request.params).handoff(parseWith(HandoffBody, request.body).text),
  );
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
