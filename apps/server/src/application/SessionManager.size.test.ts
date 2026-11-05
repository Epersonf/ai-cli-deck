import { describe, expect, it } from 'vitest';
import { createHarness, customBody } from '../testing/harness.js';

describe('terminal size shared by several devices', () => {
  it('tells every device the size once, and only when it changes', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    expect(h.sessions.sizeOf(id)).toBeNull();
    h.sessions.resize(id, 120, 40);
    h.sessions.resize(id, 120, 40); // the echo of the same device
    h.sessions.resize(id, 50, 30);
    const sizes = h.events.filter((e) => e.kind === 'size');
    expect(sizes).toEqual([
      { kind: 'size', sessionId: id, cols: 120, rows: 40 },
      { kind: 'size', sessionId: id, cols: 50, rows: 30 },
    ]);
    expect(h.sessions.sizeOf(id)).toEqual({ cols: 50, rows: 30 });
    expect(h.ptyPort.spawned[0]?.pty.size).toEqual({ cols: 50, rows: 30 });
  });

  it('keeps the size when the session is restarted (the new process starts at it, not at 80x24)', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create({ ...customBody(), provider: 'claude', command: null });
    h.sessions.resize(id, 120, 40);
    h.ptyPort.spawned[0]?.pty.exit(0);
    await h.sessions.restart(id, { provider: 'claude', args: [] });
    expect(h.sessions.sizeOf(id)).toEqual({ cols: 120, rows: 40 });
  });
});
