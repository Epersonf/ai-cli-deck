import { ApprovalService } from '../application/ApprovalService.js';
import { BrowserService } from '../application/BrowserService.js';
import { PreviewService } from '../application/PreviewService.js';
import { FakeBrowserEngine } from './fakeBrowser.js';
import { createHarness, agentBody } from './harness.js';
import { applyMemoryRequest } from '../application/memoryApply.js';
import { memoryAccess } from './memoryKit.js';
import { createAgentTools } from '../interface/agent/agentTools.js';

/** Agent tools wired to fakes: three sessions (two share a folder) and the real services around them. */
export async function setupAgents() {
  const h = createHarness();
  const approvals = new ApprovalService({
    sessions: h.sessions,
    worktrees: { add: () => Promise.reject(new Error('git must not run')) },
    system: h.system,
    bus: h.bus,
    memory: { apply: (r) => applyMemoryRequest(h.memory, r) },
  });
  const preview = new PreviewService(h.sessions, h.bus);
  const a = await h.sessions.create(agentBody('/work', true));
  const b = await h.sessions.create(agentBody('/work', false));
  const c = await h.sessions.create(agentBody('/other', false));
  const deps = {
    sessions: h.sessions,
    phone: null,
    tasks: h.tasks,
    approvals,
    memoryAccess: memoryAccess(h.memory, {
      approvals,
      providers: h.providers,
      sessions: h.sessions,
    }),
    preview,
    browser: new BrowserService(new FakeBrowserEngine()),
  };
  return { h, a, b, c, deps, tools: createAgentTools(deps, a.id) };
}
