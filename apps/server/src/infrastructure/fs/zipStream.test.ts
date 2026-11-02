import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectEntries, zipStream } from './zipStream.js';

async function bytesOf(stream: AsyncIterable<unknown>): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const chunk of stream) parts.push(chunk as Buffer);
  return Buffer.concat(parts);
}

describe('zipStream', () => {
  it('produces an archive that python can read back byte for byte', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    try {
      const src = join(dir, 'proj');
      mkdirSync(join(src, 'sub'), { recursive: true });
      mkdirSync(join(src, 'empty'));
      mkdirSync(join(src, 'node_modules'));
      writeFileSync(join(src, 'node_modules', 'skip.js'), 'x');
      writeFileSync(join(src, 'a.txt'), 'olá mundo\n'.repeat(5000));
      writeFileSync(join(src, 'sub', 'b.bin'), Buffer.from([0, 1, 2, 255, 254]));
      symlinkSync('/etc/passwd', join(src, 'link'));
      const entries = await collectEntries(src, 'proj');
      expect(entries.map((e) => e.name).sort()).toEqual([
        'proj/a.txt',
        'proj/empty/',
        'proj/sub/',
        'proj/sub/b.bin',
      ]);
      const out = join(dir, 'out.zip');
      writeFileSync(out, await bytesOf(zipStream(entries)));
      const check = [
        'import zipfile,sys',
        'z=zipfile.ZipFile(sys.argv[1])',
        'assert z.testzip() is None',
        'print(sorted(z.namelist()))',
        'print(z.read("proj/a.txt")==open(sys.argv[2],"rb").read())',
        'print(z.read("proj/sub/b.bin")==bytes([0,1,2,255,254]))',
      ].join('\n');
      const result = execFileSync('python3', ['-I', '-c', check, out, join(src, 'a.txt')], {
        encoding: 'utf8',
      });
      expect(result).toContain("'proj/a.txt'");
      expect(result.split('\n').slice(1, 3)).toEqual(['True', 'True']);
      expect(readFileSync(out).length).toBeGreaterThan(100);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
