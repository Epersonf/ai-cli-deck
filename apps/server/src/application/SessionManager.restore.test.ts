import { describe, expect, it } from 'vitest';
import { customBody, createHarness } from '../testing/harness.js';

describe('SessionManager restore and shared folders', () => {
  it('reattaches sessions whose tmux session is still alive', async () => {
    const first = createHarness();
    const created = await first.sessions.create(customBody());
    const second = createHarness({ stored: first.store.saved, liveTmux: [`deck-${created.id}`] });
    await second.sessions.restore();
    expect(second.sessions.get(created.id)?.status).toBe('running');
    expect(second.ptyPort.spawned).toHaveLength(1);
  });

  it('marks sessions without a live tmux session as exited', async () => {
    const first = createHarness();
    const created = await first.sessions.create(customBody());
    const second = createHarness({ stored: first.store.saved, liveTmux: [] });
    await second.sessions.restore();
    expect(second.sessions.get(created.id)?.status).toBe('exited');
    expect(second.ptyPort.spawned).toHaveLength(0);
  });

  it('flags live sessions that share a folder', async () => {
    const h = createHarness();
    const a = await h.sessions.create(customBody('/work'));
    const b = await h.sessions.create(customBody('/work'));
    const c = await h.sessions.create(customBody('/other'));
    expect(h.sessions.get(a.id)?.sharedCwdWith).toEqual([b.id]);
    expect(h.sessions.get(b.id)?.sharedCwdWith).toEqual([a.id]);
    expect(h.sessions.get(c.id)?.sharedCwdWith).toEqual([]);
  });

  it('only accepts localhost preview URLs', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    expect(h.sessions.setPreview(id, 'http://localhost:3000/x')).toBe('http://localhost:3000/x');
    expect(() => h.sessions.setPreview(id, 'http://evil.com')).toThrow('localhost');
    expect(h.sessions.get(id)?.previewUrl).toBe('http://localhost:3000/x');
  });
});
