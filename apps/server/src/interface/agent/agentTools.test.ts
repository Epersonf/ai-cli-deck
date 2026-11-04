import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../../application/ApprovalService.js';
import { BrowserService } from '../../application/BrowserService.js';
import { PreviewService } from '../../application/PreviewService.js';
import { FakeBrowserEngine } from '../../testing/fakeBrowser.js';
import { createHarness, customBody } from '../../testing/harness.js';
import { createAgentTools } from './agentTools.js';

async function setup() {
  const h = createHarness();
  const approvals = new ApprovalService({
    sessions: h.sessions,
    worktrees: { add: () => Promise.reject(new Error('git must not run')) },
    system: h.system,
    bus: h.bus,
  });
  const preview = new PreviewService(h.sessions, h.bus);
  const a = await h.sessions.create(customBody('/work', true));
  const b = await h.sessions.create(customBody('/work', false));
  const c = await h.sessions.create(customBody('/other', false));
  const deps = {
    sessions: h.sessions,
    handoffs: h.handoffs,
    approvals,
    preview,
    browser: new BrowserService(new FakeBrowserEngine()),
  };
  return { h, a, b, c, deps, tools: createAgentTools(deps, a.id) };
}

describe('agent tools', () => {
  it('lists other sessions and flags the ones in the same folder', async () => {
    const { tools, b, c } = await setup();
    expect(tools.listSessions().map((s) => [s.id, s.sameFolderAsYou])).toEqual([
      [b.id, true],
      [c.id, false],
    ]);
  });

  it('never lists terminals of another profile', async () => {
    const { tools, h } = await setup();
    const other = await h.sessions.create({ ...customBody('/work'), provider: 'shell' });
    expect(tools.listSessions().map((s) => s.id)).not.toContain(other.id);
  });

  it('reads and sets only its own title, trimmed and capped', async () => {
    const { tools, h, a, b } = await setup();
    await expect(tools.title()).resolves.toEqual({ title: null });
    await expect(tools.title('  Fix   login\nbug ')).resolves.toEqual({ title: 'Fix login bug' });
    expect(h.sessions.get(a.id)?.name).toBe('Fix login bug');
    expect(h.sessions.get(b.id)?.name).toBeNull();
    expect((await tools.title('x'.repeat(200))).title).toHaveLength(60);
    await expect(tools.title('   ')).resolves.toEqual({ title: null });
  });

  it('describes the calling session', async () => {
    const { tools, a } = await setup();
    expect(tools.whoami()).toMatchObject({ id: a.id, cwd: '/work', port: a.port });
  });

  it('only proposes a worktree and never runs git', async () => {
    const { tools, deps } = await setup();
    const proposal = tools.proposeWorktree('isolate refactor');
    expect(proposal.status).toBe('pending');
    expect(tools.requestStatus(proposal.requestId)).toEqual({ status: 'pending', path: null });
    expect(deps.approvals.list('pending')).toHaveLength(1);
  });

  it('refuses a proposal when worktrees are disabled for the session', async () => {
    const { deps, b } = await setup();
    expect(() => createAgentTools(deps, b.id).proposeWorktree('why')).toThrow('disabled');
  });

  it('does not leak other sessions requests', async () => {
    const { deps, tools, a } = await setup();
    const { requestId } = tools.proposeWorktree('x');
    const other = await deps.sessions.create(customBody('/other', true));
    expect(() => createAgentTools(deps, other.id).requestStatus(requestId)).toThrow('not found');
    expect(a.id).not.toBe(other.id);
  });

  it('opens previews on localhost only and expands bare ports', async () => {
    const { tools, deps, a } = await setup();
    expect(tools.openPreview('3000')).toEqual({ url: 'http://localhost:3000/' });
    expect(deps.sessions.get(a.id)?.previewUrl).toBe('http://localhost:3000/');
    expect(() => tools.openPreview('https://example.com')).toThrow('localhost');
    expect(() => tools.suggestNewTab('http://evil.com')).toThrow('localhost');
    expect(tools.suggestNewTab('localhost:5173')).toEqual({ url: 'http://localhost:5173/' });
  });
});
