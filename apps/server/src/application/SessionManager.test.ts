import { describe, expect, it } from 'vitest';
import { customBody, createHarness } from '../testing/harness.js';

describe('SessionManager lifecycle', () => {
  it('creates a running session wrapped in tmux with its own PORT', async () => {
    const h = createHarness();
    const session = await h.sessions.create(customBody());
    expect(session).toMatchObject({ status: 'running', port: 4100, persistent: true });
    const spawned = h.ptyPort.spawned[0];
    expect(spawned?.spec.command).toBe('tmux');
    expect(spawned?.spec.env['PORT']).toBe('4100');
    expect(spawned?.spec.env['DECK_SESSION_ID']).toBe(session.id);
    expect(spawned?.spec.env['DECK_URL']).toBe('http://127.0.0.1:7842');
    expect(spawned?.spec.env['PATH']).toBe('/deck/bin:/bin');
    expect(h.store.saved).toHaveLength(1);
  });

  it('falls back to a plain pty without tmux', async () => {
    const h = createHarness({ tmux: false });
    const session = await h.sessions.create(customBody());
    expect(session.persistent).toBe(false);
    expect(h.ptyPort.spawned[0]?.spec.command).toBe('bash');
  });

  it('rejects unknown directories and providers', async () => {
    const h = createHarness();
    await expect(h.sessions.create(customBody('/nope'))).rejects.toThrow('Not a directory');
    await expect(h.sessions.create({ ...customBody(), provider: 'ghost' })).rejects.toThrow(
      'Unknown provider',
    );
    expect(h.sessions.list()).toHaveLength(0);
  });

  it('allocates distinct ports and frees them on remove', async () => {
    const h = createHarness();
    const a = await h.sessions.create(customBody());
    const b = await h.sessions.create(customBody('/other'));
    expect([a.port, b.port]).toEqual([4100, 4101]);
    await h.sessions.remove(a.id);
    expect(h.mux.killed).toEqual([`deck-${a.id}`]);
    const c = await h.sessions.create(customBody());
    expect(c.port).toBe(4100);
  });

  it('forwards input and resize to the pty and marks exit', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    const pty = h.ptyPort.spawned[0]?.pty;
    h.sessions.sendInput(id, 'ls\r');
    h.sessions.resize(id, 100, 30);
    expect(pty?.writes).toEqual(['ls\r']);
    expect(pty?.size).toEqual({ cols: 100, rows: 30 });
    pty?.exit(0);
    expect(h.sessions.get(id)?.status).toBe('exited');
    expect(h.events.some((e) => e.kind === 'exit')).toBe(true);
  });

  it('replays recent output from the ring buffer when tmux cannot capture', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    h.ptyPort.spawned[0]?.pty.emit('hello ');
    h.ptyPort.spawned[0]?.pty.emit('world');
    expect(Buffer.from(await h.sessions.replay(id)).toString()).toBe('hello world');
  });

  it('throws not-found for unknown sessions', () => {
    const h = createHarness();
    expect(() => h.sessions.sendInput('ghost', 'x')).toThrow('not found');
  });
});
