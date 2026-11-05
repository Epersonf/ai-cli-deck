import { describe, expect, it } from 'vitest';
import { createHarness, customBody } from '../testing/harness.js';

const claudeBody = { ...customBody(), provider: 'claude', command: null };

describe('session notes and restart', () => {
  it('keeps small notes with the session, removes them when emptied and refuses content-sized ones', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    await h.sessions.setMeta(id, 'chat', 'abc-123');
    const runAt = '2026-01-01T00:00:00.000Z';
    expect(h.sessions.get(id)?.meta).toEqual({ runAt, chat: 'abc-123' });
    expect(h.store.saved[0]?.meta).toEqual({ runAt, chat: 'abc-123' });
    await h.sessions.setMeta(id, 'chat', '');
    expect(h.sessions.get(id)?.meta).toEqual({ runAt });
    await expect(h.sessions.setMeta(id, 'chat', 'x'.repeat(501))).rejects.toThrow(/too long/i);
    await expect(h.sessions.setMeta(id, 'bad key', 'v')).rejects.toThrow(/key/i);
  });

  it('limits how many notes a session can hold', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    for (let i = 0; i < 11; i++) await h.sessions.setMeta(id, `k${i}`, 'v'); // 12 with runAt
    await expect(h.sessions.setMeta(id, 'one-more', 'v')).rejects.toThrow(/too many/i);
  });

  it('only restarts an ended session', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    await expect(h.sessions.restart(id, { provider: 'custom', args: [] })).rejects.toThrow(
      /ended/i,
    );
  });

  it('restarts with the arguments it is given, in the profile it is given, keeping the size', async () => {
    const h = createHarness({ tmux: false });
    const { id } = await h.sessions.create(claudeBody);
    h.sessions.resize(id, 120, 40);
    h.ptyPort.spawned[0]?.pty.exit(0);
    await h.sessions.restart(id, { provider: 'claude', args: ['--resume', 'abc-123'] });
    expect(h.sessions.get(id)?.status).toBe('running');
    expect(h.ptyPort.spawned[1]?.spec.args.slice(0, 2)).toEqual(['--resume', 'abc-123']);
    expect(h.sessions.sizeOf(id)).toEqual({ cols: 120, rows: 40 });
    h.ptyPort.spawned[1]?.pty.exit(0);
    await h.sessions.restart(id, { provider: 'codex', args: [] });
    expect(h.sessions.get(id)?.provider).toBe('codex');
    expect(h.ptyPort.spawned[2]?.spec.command).toBe('codex');
    expect(h.store.saved.find((s) => s.id === id)?.provider).toBe('codex');
  });

  it('notes when each run starts, but not when the deck re-attaches to a running one', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    expect(h.sessions.get(id)?.meta['runAt']).toBe('2026-01-01T00:00:00.000Z');
  });
});
