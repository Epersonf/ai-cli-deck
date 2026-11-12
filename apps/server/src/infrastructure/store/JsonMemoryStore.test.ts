import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonMemoryStore } from './JsonMemoryStore.js';

const tree = { folders: [], entries: [] };

describe('the memory files', () => {
  it('are plain JSON: global.json and profiles/<id>.json, read back and removed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mem-'));
    const store = new JsonMemoryStore(dir);
    await store.save('global', tree);
    await store.save('profile:claude', tree);
    expect(JSON.parse(readFileSync(join(dir, 'global.json'), 'utf8'))).toEqual(tree);
    expect(existsSync(join(dir, 'profiles', 'claude.json'))).toBe(true);
    expect(Object.keys(await store.loadAll()).sort()).toEqual(['global', 'profile:claude']);
    await store.remove('profile:claude');
    expect(Object.keys(await store.loadAll())).toEqual(['global']);
  });

  it('ignore a file that is not valid, and never rewrite it on read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mem-'));
    writeFileSync(join(dir, 'global.json'), '{ not json');
    const store = new JsonMemoryStore(dir);
    expect(await store.loadAll()).toEqual({});
    expect(readFileSync(join(dir, 'global.json'), 'utf8')).toBe('{ not json');
  });
});
