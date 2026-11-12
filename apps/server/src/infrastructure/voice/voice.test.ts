import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { wavHeader } from '../../application/wav.js';
import type { Asset } from './assets.js';
import { locate } from './locate.js';
import { WhisperEngine, type EngineDeps } from './WhisperEngine.js';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'deck-voice-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const asset = (text: string): Asset => ({
  url: 'http://x/a',
  sha256: sha(text),
  size: text.length,
});
const audio = (seconds: number): Buffer =>
  Buffer.concat([wavHeader(seconds * 32000), Buffer.alloc(seconds * 32000)]);

const engine = (extra: Partial<EngineDeps> = {}) =>
  new WhisperEngine({ dir, platform: 'win32', arch: 'x64', env: {}, ...extra });

describe('finding an engine in PATH', () => {
  it('finds the first name present, with .exe on Windows', () => {
    expect(
      locate(['whisper-cli', 'whisper-cpp'], { PATH: '/bin' }, 'linux', (p) =>
        p.endsWith('whisper-cpp'),
      ),
    ).toMatch(/whisper-cpp$/);
    expect(
      locate(['whisper-cli'], { PATH: 'C:\\bin' }, 'win32', (p) => p.endsWith('whisper-cli.exe')),
    ).toContain('whisper-cli.exe');
    expect(locate(['whisper-cli'], { PATH: '/nowhere' }, 'linux', () => false)).toBeNull();
  });
});

describe('the speech engine', () => {
  it('is unsupported off Windows without a whisper command, with a hint, and refuses to prepare', () => {
    const e = engine({ platform: 'linux', env: { PATH: '/nowhere' } });
    expect(e.status()).toMatchObject({ supported: false, ready: false, downloading: false });
    expect(e.status().hint).toContain('whisper');
    expect(() => e.prepare()).toThrow(/whisper/);
  });

  it('downloads the engine and the model on Windows, then is ready', async () => {
    const got: string[] = [];
    const e = engine({
      engine: asset('zip'),
      model: asset('model'),
      download: (a, dest, onBytes) => {
        got.push(a.sha256 === sha('zip') ? 'engine' : 'model');
        onBytes?.(a.size);
        return writeFile(dest, a.sha256 === sha('zip') ? 'zip' : 'model');
      },
      extract: async (_zip, into) => {
        await mkdir(join(into, 'Release'), { recursive: true });
        await writeFile(join(into, 'Release', 'whisper-cli.exe'), 'exe');
      },
    });
    expect(e.status()).toMatchObject({ supported: true, ready: false });
    expect(e.prepare().downloading).toBe(true);
    await tick();
    expect(got).toEqual(['engine', 'model']);
    expect(e.status()).toMatchObject({
      ready: true,
      downloading: false,
      progress: 100,
      error: null,
    });
  });

  it('says why a download failed and can be tried again', async () => {
    let fail = true;
    const e = engine({
      engine: asset('zip'),
      model: asset('model'),
      download: (_a, dest) => (fail ? Promise.reject(new Error('offline')) : writeFile(dest, 'x')),
      extract: async (_zip, into) => {
        await writeFile(join(into, 'Release-whisper-cli.exe'), 'x');
      },
    });
    e.prepare();
    await tick();
    expect(e.status()).toMatchObject({ ready: false, downloading: false, error: 'offline' });
    fail = false;
    expect(e.prepare().error).toBeNull();
    await tick();
  });

  it('transcribes with an engine it was given, trimming what it prints, and says nothing for a blip', async () => {
    const model = join(dir, 'ggml.bin');
    await writeFile(model, 'm');
    const calls: string[][] = [];
    const e = engine({
      platform: 'linux',
      env: { PATH: dir, DECK_WHISPER_MODEL: model },
      run: (_file, args) => {
        calls.push(args);
        return Promise.resolve('  Hello there [BLANK_AUDIO]\n');
      },
    });
    await writeFile(join(dir, 'whisper-cli'), 'x');
    expect(e.status()).toMatchObject({ supported: true, ready: true });
    expect(await e.transcribe(audio(2), 'pt-BR')).toBe('Hello there');
    expect(calls[0]).toEqual(expect.arrayContaining(['-m', model, '-l', 'pt', '--prompt']));
    expect(await e.transcribe(audio(0), 'en')).toBe('');
    expect(calls).toHaveLength(1);
  });

  it('refuses to transcribe until the model is in place', async () => {
    await writeFile(join(dir, 'whisper-cli'), 'x');
    const e = engine({ platform: 'linux', env: { PATH: dir } });
    await expect(e.transcribe(audio(2), 'en')).rejects.toThrow(/not been downloaded/);
  });
});
