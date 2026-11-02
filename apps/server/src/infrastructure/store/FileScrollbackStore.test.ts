import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileScrollbackStore } from './FileScrollbackStore.js';

let dir = '';
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('FileScrollbackStore', () => {
  it('round-trips bytes and removes them', async () => {
    dir = await mkdtemp(join(tmpdir(), 'deck-sb-'));
    const store = new FileScrollbackStore(join(dir, 'nested'));
    expect(await store.load('abc')).toBeNull();
    await store.save('abc', Buffer.from('\x1b[1mhi\x1b[0m'));
    expect(Buffer.from((await store.load('abc')) ?? []).toString()).toBe('\x1b[1mhi\x1b[0m');
    await store.remove('abc');
    expect(await store.load('abc')).toBeNull();
    expect(await readdir(join(dir, 'nested'))).toEqual([]);
  });

  it('ignores ids that could escape the folder', async () => {
    dir = await mkdtemp(join(tmpdir(), 'deck-sb-'));
    const store = new FileScrollbackStore(dir);
    await store.save('../evil', Buffer.from('x'));
    expect(await store.load('../evil')).toBeNull();
    expect(await readdir(dir)).toEqual([]);
  });
});
