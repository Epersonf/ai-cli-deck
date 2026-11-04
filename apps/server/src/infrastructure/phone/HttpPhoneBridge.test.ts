import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpPhoneBridge, phoneFromEnv } from './HttpPhoneBridge.js';

let server: Server | null = null;
afterEach(() => void server?.close());

function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
  server = createServer(handler);
  return new Promise((resolve) =>
    server?.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server?.address() as AddressInfo).port}`),
    ),
  );
}

describe('HttpPhoneBridge', () => {
  it('sends the token and the body, and returns what the phone answers', async () => {
    const seen: string[] = [];
    const url = await listen((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen.push(`${req.method} ${req.url} ${req.headers.authorization} ${body}`);
        res.setHeader('content-type', 'application/json').end('{"percent":42}');
      });
    });
    const phone = new HttpPhoneBridge(url, 'tok');
    expect(await phone.request('GET', '/battery')).toEqual({ percent: 42 });
    await phone.request('POST', '/notify', { text: 'hi' });
    expect(seen).toEqual(['GET /battery Bearer tok ', 'POST /notify Bearer tok {"text":"hi"}']);
  });

  it('turns the phone refusing into a readable error', async () => {
    const url = await listen((_req, res) => {
      res.statusCode = 403;
      res.end('{"error":"Phone access is off"}');
    });
    await expect(new HttpPhoneBridge(url, 't').request('GET', '/battery')).rejects.toThrow(
      'Phone access is off',
    );
  });

  it('says so when the phone does not answer', async () => {
    await expect(
      new HttpPhoneBridge('http://127.0.0.1:1', 't').request('GET', '/x'),
    ).rejects.toThrow(/did not answer/);
  });

  it('reads the bridge from the environment and takes the token out of it', () => {
    const env: NodeJS.ProcessEnv = {
      DECK_PHONE_URL: 'http://127.0.0.1:9',
      DECK_PHONE_TOKEN: 'x',
      A: '1',
    };
    expect(phoneFromEnv(env)).not.toBeNull();
    expect(env).toEqual({ A: '1' }); // sessions copy process.env: the token must not be in it
    expect(phoneFromEnv({})).toBeNull();
  });
});
