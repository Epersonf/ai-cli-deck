import { describe, expect, it } from 'vitest';
import { createHarness, customBody } from '../testing/harness.js';

describe('sub-terminals', () => {
  it('hang off the main session, even when opened from another sub-terminal', async () => {
    const h = createHarness();
    const main = await h.sessions.create(customBody());
    const first = await h.sessions.create({ ...customBody(), parentId: main.id });
    const second = await h.sessions.create({ ...customBody(), parentId: first.id });
    expect(first.parentId).toBe(main.id);
    expect(second.parentId).toBe(main.id);
    expect(main.parentId).toBeNull();
  });

  it('cannot hang off a session that does not exist', async () => {
    const h = createHarness();
    await expect(h.sessions.create({ ...customBody(), parentId: 'nope' })).rejects.toThrow(
      /not found|nope/i,
    );
  });

  it('end with their main session, but ending one leaves the main session alone', async () => {
    const h = createHarness();
    const main = await h.sessions.create(customBody());
    const a = await h.sessions.create({ ...customBody(), parentId: main.id });
    const b = await h.sessions.create({ ...customBody(), parentId: main.id });
    await h.sessions.remove(a.id);
    expect(h.sessions.get(main.id)).toBeDefined();
    expect(h.sessions.get(b.id)).toBeDefined();
    await h.sessions.remove(main.id);
    expect(h.sessions.list()).toEqual([]);
  });
});
