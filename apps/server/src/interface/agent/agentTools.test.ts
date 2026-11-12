import { describe, expect, it } from 'vitest';
import { setupAgents as setup } from '../../testing/agentKit.js';
import { agentBody } from '../../testing/harness.js';
import { createAgentTools } from './agentTools.js';

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
    const other = await h.sessions.create({ ...agentBody('/work'), provider: 'codex' });
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
    const other = await deps.sessions.create(agentBody('/other', true));
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
