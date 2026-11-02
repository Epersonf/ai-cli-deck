import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FileReader } from './FileReader.js';
import { resolveInside } from './pathGuard.js';

let root = '';
let outside = '';

beforeAll(async () => {
  const base = await mkdtemp(join(tmpdir(), 'deck-guard-'));
  root = join(base, 'root');
  outside = join(base, 'outside');
  await mkdir(join(root, 'sub'), { recursive: true });
  await mkdir(outside);
  await writeFile(join(root, 'sub', 'a.txt'), 'hello');
  await writeFile(join(root, 'bin.dat'), Buffer.from([1, 0, 2]));
  await writeFile(join(outside, 'secret.txt'), 'secret');
  await symlink(outside, join(root, 'escape'));
  await symlink(join(root, 'sub'), join(root, 'inner-link'));
});

describe('resolveInside', () => {
  it('resolves paths inside the root', async () => {
    expect(await resolveInside(root, 'sub/a.txt')).toMatch(/sub\/a\.txt$/);
    expect(await resolveInside(root, '')).toMatch(/root$/);
  });

  it('rejects traversal and absolute paths', async () => {
    await expect(resolveInside(root, '../outside/secret.txt')).rejects.toThrow('escapes');
    await expect(resolveInside(root, '/etc/passwd')).rejects.toThrow('escapes');
    await expect(resolveInside(root, 'sub/../../outside')).rejects.toThrow('escapes');
  });

  it('rejects symlinks that leave the root but allows inner ones', async () => {
    await expect(resolveInside(root, 'escape/secret.txt')).rejects.toThrow('escapes');
    expect(await resolveInside(root, 'inner-link/a.txt')).toMatch(/sub\/a\.txt$/);
  });

  it('reports missing paths and null bytes', async () => {
    await expect(resolveInside(root, 'missing')).rejects.toThrow('not found');
    await expect(resolveInside(root, 'a\0b')).rejects.toThrow('Invalid path');
  });
});

describe('FileReader', () => {
  const reader = new FileReader();

  it('lists entries and hides symlinks that escape', async () => {
    const names = (await reader.list(root, '')).map((e) => e.name).sort();
    expect(names).toEqual(['bin.dat', 'inner-link', 'sub']);
  });

  it('reads text, truncates and flags binary files', async () => {
    expect(await reader.read(root, 'sub/a.txt', 100)).toMatchObject({ content: 'hello' });
    expect(await reader.read(root, 'sub/a.txt', 2)).toMatchObject({
      content: 'he',
      truncated: true,
    });
    expect(await reader.read(root, 'bin.dat', 100)).toMatchObject({ binary: true, content: '' });
    await expect(reader.read(root, 'sub', 10)).rejects.toThrow('directory');
    await expect(reader.read(root, 'escape/secret.txt', 10)).rejects.toThrow('escapes');
  });
});
