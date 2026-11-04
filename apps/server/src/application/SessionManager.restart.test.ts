import { describe, expect, it } from 'vitest';
import { createHarness, customBody } from '../testing/harness.js';

const claudeBody = { ...customBody(), provider: 'claude', command: null };

describe('session notes and restart', () => {
  it('keeps small notes with the session, removes them when emptied and refuses content-sized ones', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    await h.sessions.setMeta(id, 'chat', 'abc-123');
    expect(h.sessions.get(id)?.meta).toEqual({ chat: 'abc-123' });
    expect(h.store.saved[0]?.meta).toEqual({ chat: 'abc-123' });
    await h.sessions.setMeta(id, 'chat', '');
    expect(h.sessions.get(id)?.meta).toEqual({});
    await expect(h.sessions.setMeta(id, 'chat', 'x'.repeat(501))).rejects.toThrow(/too long/i);
    await expect(h.sessions.setMeta(id, 'bad key', 'v')).rejects.toThrow(/key/i);
  });

  it('limits how many notes a session can hold', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    for (let i = 0; i < 12; i++) await h.sessions.setMeta(id, `k${i}`, 'v');
    await expect(h.sessions.setMeta(id, 'one-more', 'v')).rejects.toThrow(/too many/i);
  });

  it('only restarts an ended session', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    await expect(h.sessions.restart(id, true)).rejects.toThrow(/ended/i);
  });

  it('restarts handing the saved resume arguments to the CLI, or a fresh chat when asked', async () => {
    const h = createHarness({ tmux: false });
    const { id } = await h.sessions.create(claudeBody);
    await h.sessions.setMeta(id, 'resume', '--resume "abc 123"');
    h.ptyPort.spawned[0]?.pty.exit(0);
    await h.sessions.restart(id, true);
    expect(h.sessions.get(id)?.status).toBe('running');
    expect(h.ptyPort.spawned[1]?.spec.args.join(' ')).toContain('--resume abc 123');
    h.ptyPort.spawned[1]?.pty.exit(0);
    await h.sessions.restart(id, false);
    expect(h.ptyPort.spawned[2]?.spec.args.join(' ')).not.toContain('--resume');
  });
});
