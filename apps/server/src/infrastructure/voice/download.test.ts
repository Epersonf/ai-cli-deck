import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Asset } from './assets.js';
import { downloadVerified } from './download.js';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'deck-download-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const asset = (text: string): Asset => ({
  url: 'http://x/a',
  sha256: sha(text),
  size: text.length,
});

describe('downloading with a pinned sha256', () => {
  let server: Server;
  let base = '';
  beforeEach(async () => {
    server = createServer((req, res) => res.end(req.url === '/ok' ? 'model-bytes' : 'tampered'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(() => new Promise((resolve) => server.close(resolve)));

  it('keeps a file that matches and reports progress', async () => {
    const seen: number[] = [];
    const dest = join(dir, 'm.bin');
    await downloadVerified({ ...asset('model-bytes'), url: `${base}/ok` }, dest, (n) =>
      seen.push(n),
    );
    expect(await readFile(dest, 'utf8')).toBe('model-bytes');
    expect(seen.at(-1)).toBe(11);
  });

  it('discards a file that does not match, leaving nothing behind', async () => {
    const dest = join(dir, 'm.bin');
    await expect(
      downloadVerified({ ...asset('model-bytes'), url: `${base}/bad` }, dest),
    ).rejects.toThrow(/sha256/);
    await expect(readFile(dest)).rejects.toThrow();
    await expect(readFile(`${dest}.part`)).rejects.toThrow();
  });
});

describe('a download that stalls', () => {
  it('is continued from the partial file, and the whole is still checked', async () => {
    const whole = 'abcdefghijklmnopqrstuvwxyz';
    const requests: Array<string | undefined> = [];
    let first = true;
    const server = createServer((req, res) => {
      requests.push(req.headers.range);
      if (first) {
        first = false; // sends half and then goes quiet
        res.writeHead(200, { 'content-length': String(whole.length) });
        res.write(whole.slice(0, 13));
        return;
      }
      const from = Number(/bytes=(\d+)-/.exec(req.headers.range ?? '')?.[1] ?? 0);
      res.writeHead(206);
      res.end(whole.slice(from));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/m`;
    const dest = join(dir, 'm.bin');
    try {
      await downloadVerified({ ...asset(whole), url }, dest, { stallMs: 150 });
      expect(await readFile(dest, 'utf8')).toBe(whole);
      expect(requests).toEqual([undefined, 'bytes=13-']);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('starts over when the server ignores the range, and gives up after its tries', async () => {
    const whole = 'abcdefghij';
    const server = createServer((_req, res) => res.end(whole));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/m`;
    const dest = join(dir, 'm.bin');
    await writeFile(`${dest}.part`, 'abcde');
    try {
      await downloadVerified({ ...asset(whole), url }, dest, { stallMs: 150 });
      expect(await readFile(dest, 'utf8')).toBe(whole);
      await expect(
        downloadVerified({ ...asset(whole), url: 'http://127.0.0.1:1/none' }, join(dir, 'n.bin'), {
          tries: 2,
        }),
      ).rejects.toThrow();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
