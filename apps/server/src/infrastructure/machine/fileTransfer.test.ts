import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPath, writePath } from './fileTransfer.js';

const temp = () => mkdtemp(join(tmpdir(), 'deck-files-'));

describe('moving files between devices', () => {
  it('carries a file, into a folder or to a new name', async () => {
    const from = await temp();
    const to = await temp();
    await writeFile(join(from, 'out.png'), 'PNG bytes');
    const intoFolder = await writePath(
      to,
      'file',
      'out.png',
      (await readPath(join(from, 'out.png'))).body,
    );
    expect(intoFolder).toBe(join(to, 'out.png'));
    const renamed = await writePath(
      join(to, 'new', 'b.png'),
      'file',
      'out.png',
      (await readPath(join(from, 'out.png'))).body,
    );
    expect(await readFile(renamed, 'utf8')).toBe('PNG bytes');
  });

  it('carries a whole folder as an archive and unpacks it inside the destination', async () => {
    const from = await temp();
    const to = await temp();
    await mkdir(join(from, 'results', 'deep'), { recursive: true });
    await writeFile(join(from, 'results', 'a.txt'), 'A');
    await writeFile(join(from, 'results', 'deep', 'b.txt'), 'B');
    const out = await readPath(join(from, 'results'));
    expect(out.kind).toBe('dir');
    const landed = await writePath(to, 'dir', out.name, out.body);
    expect(landed).toBe(join(to, 'results'));
    expect(await readFile(join(to, 'results', 'deep', 'b.txt'), 'utf8')).toBe('B');
  });

  it('says when the path does not exist', async () => {
    await expect(readPath(join(await temp(), 'nope'))).rejects.toThrow('not found');
  });
});
