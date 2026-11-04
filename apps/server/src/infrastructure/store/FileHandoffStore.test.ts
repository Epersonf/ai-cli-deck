import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileHandoffStore } from './FileHandoffStore.js';

describe('FileHandoffStore', () => {
  it('writes one markdown file per session, reports it and removes it', async () => {
    const store = new FileHandoffStore(join(await mkdtemp(join(tmpdir(), 'deck-handoff-')), 'h'));
    expect(await store.info('s1')).toBeNull();
    await store.write('s1', 'done: A');
    expect(await readFile(store.pathOf('s1'), 'utf8')).toBe('done: A');
    expect((await store.info('s1'))?.bytes).toBe(7);
    await store.remove('s1');
    expect(await store.info('s1')).toBeNull();
  });

  it('ignores ids that are not plain tokens', async () => {
    const store = new FileHandoffStore(await mkdtemp(join(tmpdir(), 'deck-handoff-')));
    await store.write('../evil', 'x');
    expect(await store.info('../evil')).toBeNull();
  });
});
