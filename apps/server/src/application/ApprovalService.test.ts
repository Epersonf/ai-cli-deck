import { describe, expect, it } from 'vitest';
import type { WorktreePort } from '../domain/ports.js';
import { createHarness, customBody } from '../testing/harness.js';
import { ApprovalService, worktreePathFor } from './ApprovalService.js';

function setup() {
  const h = createHarness();
  const added: Array<{ repoDir: string; branch: string; targetPath: string }> = [];
  const worktrees: WorktreePort = {
    add: (input) => {
      added.push(input);
      return Promise.resolve();
    },
  };
  const approvals = new ApprovalService({
    sessions: h.sessions,
    worktrees,
    system: h.system,
    bus: h.bus,
  });
  return { h, approvals, added };
}

describe('ApprovalService worktree flow', () => {
  it('proposing never touches git', async () => {
    const { h, approvals, added } = setup();
    const { id } = await h.sessions.create(customBody('/work', true));
    const request = approvals.propose(id, 'parallel work');
    expect(request).toMatchObject({ status: 'pending', resultPath: null, kind: 'worktree' });
    expect(added).toHaveLength(0);
    expect(h.sessions.get(id)?.cwd).toBe('/work');
  });

  it('refuses proposals when worktrees are off for the session', async () => {
    const { h, approvals } = setup();
    const { id } = await h.sessions.create(customBody('/work', false));
    expect(() => approvals.propose(id, 'why')).toThrow('disabled');
  });

  it('creates the worktree only after approval and updates the session', async () => {
    const { h, approvals, added } = setup();
    const { id } = await h.sessions.create(customBody('/work', true));
    const request = approvals.propose(id, 'why');
    const done = await approvals.decide(request.id, 'approve');
    expect(added).toEqual([
      { repoDir: '/work', branch: `deck/${id}`, targetPath: worktreePathFor('/work', id) },
    ]);
    expect(done).toMatchObject({ status: 'approved', resultPath: `/work-deck-${id}` });
    expect(h.sessions.get(id)).toMatchObject({ cwd: `/work-deck-${id}` });
    expect(approvals.get(request.id).status).toBe('approved');
  });

  it('rejecting never creates a worktree', async () => {
    const { h, approvals, added } = setup();
    const { id } = await h.sessions.create(customBody('/work', true));
    const request = approvals.propose(id, 'why');
    expect((await approvals.decide(request.id, 'reject')).status).toBe('rejected');
    expect(added).toHaveLength(0);
    expect(h.sessions.get(id)?.worktree.path).toBeNull();
  });

  it('cannot decide twice and reuses the pending request', async () => {
    const { h, approvals } = setup();
    const { id } = await h.sessions.create(customBody('/work', true));
    const first = approvals.propose(id, 'a');
    expect(approvals.propose(id, 'b').id).toBe(first.id);
    await approvals.decide(first.id, 'reject');
    await expect(approvals.decide(first.id, 'approve')).rejects.toThrow('already rejected');
  });

  it('keeps the request pending when git fails', async () => {
    const h = createHarness();
    const failing: WorktreePort = { add: () => Promise.reject(new Error('git boom')) };
    const approvals = new ApprovalService({
      sessions: h.sessions,
      worktrees: failing,
      system: h.system,
      bus: h.bus,
    });
    const { id } = await h.sessions.create(customBody('/work', true));
    const request = approvals.propose(id, 'why');
    await expect(approvals.decide(request.id, 'approve')).rejects.toThrow('git boom');
    expect(approvals.get(request.id).status).toBe('pending');
    expect(h.sessions.get(id)?.worktree.path).toBeNull();
  });
});
