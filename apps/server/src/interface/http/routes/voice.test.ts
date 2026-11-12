import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { wavHeader } from '../../../application/wav.js';
import { conflict } from '../../../domain/errors.js';
import type { VoicePort } from '../../../domain/voice.js';
import type { Container } from '../../container.js';
import { registerErrorHandler } from '../errors.js';
import { voiceRoutes } from './voice.js';

const status = {
  supported: true,
  ready: true,
  downloading: false,
  progress: 100,
  error: null,
  hint: null,
};

async function app(voice: Partial<VoicePort> = {}) {
  const asked: Array<[number, string]> = [];
  const port: VoicePort = {
    status: () => status,
    prepare: () => ({ ...status, ready: false, downloading: true }),
    transcribe: (wav, lang) => {
      asked.push([wav.length, lang]);
      return Promise.resolve('hello');
    },
    ...voice,
  };
  const server = Fastify();
  registerErrorHandler(server);
  voiceRoutes(server, { voice: port } as unknown as Container);
  await server.ready();
  return { server, asked };
}

const recording = (bytes: number): Buffer => Buffer.concat([wavHeader(bytes), Buffer.alloc(bytes)]);
const wavHeaders = { 'content-type': 'audio/wav' };

describe('voice routes', () => {
  it('tells whether voice is supported, ready and downloading, and starts the download', async () => {
    const { server } = await app();
    const got = await server.inject('/api/voice/status');
    expect(got.json()).toMatchObject({ supported: true, ready: true, downloading: false });
    const prepared = await server.inject({ method: 'POST', url: '/api/voice/prepare' });
    expect(prepared.json()).toMatchObject({ downloading: true });
  });

  it('turns a 16 kHz mono WAV body into text, with the language from the query', async () => {
    const { server, asked } = await app();
    const res = await server.inject({
      method: 'POST',
      url: '/api/voice/transcribe?lang=pt-BR',
      headers: wavHeaders,
      payload: recording(64000),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ text: 'hello' });
    expect(asked).toEqual([[64044, 'pt-BR']]);
  });

  it('refuses what is not a usable recording, a bad language, and a body that is too big', async () => {
    const { server } = await app();
    const post = (url: string, payload: Buffer) =>
      server.inject({ method: 'POST', url, headers: wavHeaders, payload });
    expect(
      (await post('/api/voice/transcribe', Buffer.from('not a wav at all, no'.repeat(5))))
        .statusCode,
    ).toBe(400);
    const stereo = recording(64000);
    stereo.writeUInt16LE(2, 22);
    expect((await post('/api/voice/transcribe', stereo)).statusCode).toBe(400);
    expect((await post('/api/voice/transcribe?lang=../x', recording(64000))).statusCode).toBe(400);
    expect((await post('/api/voice/transcribe', recording(9 * 1024 * 1024))).statusCode).toBe(413);
  });

  it('passes on that the model is not ready yet', async () => {
    const { server } = await app({ transcribe: () => Promise.reject(conflict('not downloaded')) });
    const res = await server.inject({
      method: 'POST',
      url: '/api/voice/transcribe',
      headers: wavHeaders,
      payload: recording(64000),
    });
    expect(res.statusCode).toBe(409);
  });
});
