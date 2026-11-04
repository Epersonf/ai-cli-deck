import { AGENT_PATH } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { RunTaskBodySchema, WatchBatteryBodySchema } from '@deck/shared';
import { z } from 'zod';
import { createAgentTools } from '../../agent/agentTools.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const Params = z.object({ sessionId: z.string().min(1) });
const TaskParams = Params.extend({ taskId: z.string().min(1) });
const RequestParams = Params.extend({ requestId: z.string().min(1) });
const UrlBody = z.object({ url: z.string().min(1) });
const TitleBody = z.object({ title: z.string().max(200) });
const MetaQuery = z.object({ key: z.string().min(1).optional() });
const MetaBody = z.object({ key: z.string().min(1), value: z.string() });
const HandoffBody = z.object({ text: z.string() });
const NotifyBody = z.object({
  text: z.string().min(1).max(400),
  title: z.string().max(80).optional(),
});
const WifiConnectBody = z.object({
  ssid: z.string().min(1).max(64),
  password: z.string().max(100).optional(),
});
const WifiEnableBody = z.object({ on: z.boolean() });
const PhoneCallBody = z.object({
  path: z.string().min(2).max(40),
  args: z.record(z.string(), z.unknown()).optional(),
});
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
  app.get(`${base}/phone/battery`, (request) => tools(request.params).phoneBattery());
  app.get(`${base}/phone/device`, (request) => tools(request.params).phoneDevice());
  app.get(`${base}/phone/capabilities`, (request) => tools(request.params).phoneCapabilities());
  app.post(`${base}/phone/call`, (request) => {
    const { path, args } = parseWith(PhoneCallBody, request.body);
    return tools(request.params).phoneCall(path, args);
  });
  app.get(`${base}/phone/wifi`, (request) => tools(request.params).phoneWifi());
  app.get(`${base}/phone/wifi/scan`, (request) => tools(request.params).phoneWifiScan());
  app.post(`${base}/phone/wifi/connect`, (request) => {
    const { ssid, password } = parseWith(WifiConnectBody, request.body);
    return tools(request.params).phoneWifiConnect(ssid, password);
  });
  app.post(`${base}/phone/wifi/enable`, (request) =>
    tools(request.params).phoneWifiEnable(parseWith(WifiEnableBody, request.body).on),
  );
  app.post(`${base}/phone/notify`, (request) => {
    const { text, title } = parseWith(NotifyBody, request.body);
    return tools(request.params).phoneNotify(text, title);
  });
  app.get(`${base}/tasks`, (request) => tools(request.params).taskList());
  app.post(`${base}/tasks`, (request) => {
    const { command, name } = parseWith(RunTaskBodySchema, request.body);
    return tools(request.params).taskRun(command, name);
  });
  app.post(`${base}/tasks/battery`, (request) => {
    const { name, ...rule } = parseWith(WatchBatteryBodySchema, request.body);
    return tools(request.params).taskWatchBattery(rule, name);
  });
  app.delete(`${base}/tasks/:taskId`, (request) =>
    tools(request.params).taskStop(parseWith(TaskParams, request.params).taskId),
  );
  app.get(`${base}/tasks/:taskId/log`, (request) =>
    tools(request.params).taskLog(parseWith(TaskParams, request.params).taskId),
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
