import { describe, expect, it } from 'vitest';
import { FakeScrollback } from '../testing/fakes.js';
import { customBody, createHarness } from '../testing/harness.js';

const text = (bytes: Uint8Array): string => Buffer.from(bytes).toString('utf8');

describe('terminal screen persistence', () => {
  it('saves the screen of sessions that printed something, once per change', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    h.ptyPort.spawned[0]?.pty.emit('hello');
    await h.sessions.screens.flush();
    expect(text(h.scrollback.files.get(id) ?? new Uint8Array())).toBe('hello');

    h.scrollback.files.delete(id);
    await h.sessions.screens.flush();
    expect(h.scrollback.files.has(id)).toBe(false);
  });

  it('prefers the multiplexer capture over the raw buffer', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    h.mux.captured = Buffer.from('clean screen');
    h.ptyPort.spawned[0]?.pty.emit('raw \x1b[2J noise');
    await h.sessions.screens.flush();
    expect(text(h.scrollback.files.get(id) ?? new Uint8Array())).toBe('clean screen');
  });

  it('shows the saved screen of a session that died with the server', async () => {
    const scrollback = new FakeScrollback();
    const first = createHarness({ scrollback });
    const { id } = await first.sessions.create(customBody());
    first.ptyPort.spawned[0]?.pty.emit('build ok');
    await first.sessions.screens.flush();

    const second = createHarness({ stored: first.store.saved, liveTmux: [], scrollback });
    await second.sessions.restore();
    expect(second.sessions.get(id)?.status).toBe('exited');
    const shown = text(await second.sessions.replay(id));
    expect(shown).toContain('build ok');
    expect(shown).toContain('session ended');
  });

  it('keeps an ended session blank when nothing was ever saved', async () => {
    const first = createHarness();
    const { id } = await first.sessions.create(customBody());
    const second = createHarness({ stored: first.store.saved, liveTmux: [] });
    await second.sessions.restore();
    expect((await second.sessions.replay(id)).byteLength).toBe(0);
  });

  it('erases the saved screen when the session is deleted', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(customBody());
    h.ptyPort.spawned[0]?.pty.emit('secret');
    await h.sessions.screens.flush();
    await h.sessions.remove(id);
    expect(h.scrollback.files.has(id)).toBe(false);
  });
});
