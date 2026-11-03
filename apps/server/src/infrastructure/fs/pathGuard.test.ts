import { lstat, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
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

describe('FileReader.resolveFile', () => {
  const reader = new FileReader();

  it('returns real path and size for files only', async () => {
    expect(await reader.resolveFile(root, 'sub/a.txt')).toMatchObject({ size: 5 });
    await expect(reader.resolveFile(root, 'sub')).rejects.toThrow('not a file');
    await expect(reader.resolveFile(root, 'escape/secret.txt')).rejects.toThrow('escapes');
  });
});

describe('FileReader.remove', () => {
  const reader = new FileReader();
  const exists = (p: string) =>
    lstat(p).then(
      () => true,
      () => false,
    );

  it('deletes a file and refuses the root and escapes', async () => {
    await writeFile(join(root, 'sub', 'del.txt'), 'x');
    await reader.remove(root, 'sub/del.txt');
    expect(await exists(join(root, 'sub', 'del.txt'))).toBe(false);
    await expect(reader.remove(root, '')).rejects.toThrow('Invalid path');
    await expect(reader.remove(root, '../outside/secret.txt')).rejects.toThrow('escapes');
    await expect(reader.remove(root, 'escape/secret.txt')).rejects.toThrow('escapes');
    await expect(reader.remove(root, 'missing.txt')).rejects.toThrow('not found');
    expect(await exists(join(outside, 'secret.txt'))).toBe(true);
  });

  it('deletes a folder with its contents', async () => {
    await mkdir(join(root, 'tmpdir', 'deep'), { recursive: true });
    await writeFile(join(root, 'tmpdir', 'deep', 'f.txt'), 'x');
    await reader.remove(root, 'tmpdir');
    expect(await exists(join(root, 'tmpdir'))).toBe(false);
  });

  it('deletes a symlink without touching its target', async () => {
    await writeFile(join(outside, 'keep.txt'), 'k');
    await symlink(join(outside, 'keep.txt'), join(root, 'link.txt'));
    await reader.remove(root, 'link.txt');
    expect(await exists(join(root, 'link.txt'))).toBe(false);
    expect(await exists(join(outside, 'keep.txt'))).toBe(true);
  });
});
