import { describe, expect, it } from 'vitest';
import { createHarness, customBody } from '../testing/harness.js';
import { HANDOFF_REQUEST } from './HandoffService.js';

const claude = { ...customBody(), provider: 'claude', command: null };
const codex = { ...customBody(), provider: 'codex', command: null };

describe('handoff, fork and move', () => {
  it('asks a running agent for its handoff: the line first, Enter separately', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(claude);
    await h.handoffs.request(id);
    expect(h.ptyPort.spawned[0]?.pty.writes).toEqual([HANDOFF_REQUEST, '\r']);
  });

  it('does not ask an ended terminal', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(claude);
    h.ptyPort.spawned[0]?.pty.exit(0);
    await expect(h.handoffs.request(id)).rejects.toThrow(/ended/i);
  });

  it('keeps the handoff as a file-sized note, never empty or huge', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(claude);
    await expect(h.handoffs.save(id, '  ')).rejects.toThrow(/empty/i);
    await expect(h.handoffs.save(id, 'x'.repeat(8001))).rejects.toThrow(/too long/i);
    expect((await h.handoffs.save(id, 'did A, B left')).bytes).toBe(13);
    await h.handoffs.forget(id);
    expect(await h.handoffs.info(id)).toBeNull();
  });

  it('forks in the same profile with the CLI’s own fork arguments, no summary needed', async () => {
    const h = createHarness({ tmux: false });
    const source = await h.sessions.create(claude);
    await h.sessions.setMeta(source.id, 'fork', '--resume abc --fork-session');
    const copy = await h.handoffs.fork(source.id, { useHandoff: true });
    expect(copy.id).not.toBe(source.id);
    expect(copy.cwd).toBe(source.cwd);
    expect(h.ptyPort.spawned[1]?.spec.args.join(' ')).toContain('--resume abc --fork-session');
  });

  it('moves to another profile starting from the handoff note', async () => {
    const h = createHarness({ tmux: false });
    const source = await h.sessions.create(claude);
    await h.sessions.setMeta(source.id, 'fork', '--resume abc --fork-session');
    await h.handoffs.save(source.id, 'notes');
    const moved = await h.handoffs.fork(source.id, { provider: 'codex', useHandoff: true });
    expect(moved.provider).toBe('codex');
    const args = h.ptyPort.spawned[1]?.spec.args.join(' ') ?? '';
    expect(args).toContain(`/handoffs/${source.id}.md`);
    expect(args).not.toContain('--fork-session');
  });

  it('starts plain when there is nothing to carry over, or the user skipped it', async () => {
    const h = createHarness({ tmux: false });
    const source = await h.sessions.create(codex);
    await h.handoffs.fork(source.id, { useHandoff: true }); // no note, no fork arguments
    await h.handoffs.save(source.id, 'notes');
    await h.handoffs.fork(source.id, { useHandoff: false }); // skipped
    expect(h.ptyPort.spawned[1]?.spec.args.join(' ')).not.toContain('handoffs');
    expect(h.ptyPort.spawned[2]?.spec.args.join(' ')).not.toContain('handoffs');
  });

  it('never forks a sub-terminal', async () => {
    const h = createHarness();
    const main = await h.sessions.create(claude);
    const sub = await h.sessions.create({ ...customBody(), parentId: main.id });
    await expect(h.handoffs.fork(sub.id, { useHandoff: true })).rejects.toThrow(/sub-terminal/i);
  });
});
