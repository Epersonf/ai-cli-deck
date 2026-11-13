import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Session } from '@deck/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonSessionStore } from './JsonSessionStore.js';

const session = (id: string): Session => ({
  id,
  provider: 'shell',
  cwd: '/w',
  status: 'idle',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastMessageAt: null,
  previewUrl: null,
  port: 4100,
  worktree: { enabled: false, path: null, branch: null },
  sharedCwdWith: [],
  name: null,
  parentId: null,
  meta: {},
});

let dir = '';
beforeEach(async () => void (dir = await mkdtemp(join(tmpdir(), 'deck-store-'))));
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('the saved session list', () => {
  it('survives several saves at once (a program ending while a terminal is removed), keeping the last', async () => {
    const store = new JsonSessionStore(join(dir, 'sessions.json'));
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => store.save([session(id)])));
    expect((await store.load()).map((s) => s.id)).toEqual(['d']);
  });
});
