import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { invalid } from '../../../domain/errors.js';
import { checkWav } from '../../../application/wav.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

/** A recording of this size is about four minutes of 16 kHz mono PCM16. */
export const MAX_VOICE_BYTES = 8 * 1024 * 1024;
const WAV_TYPES = ['audio/wav', 'audio/x-wav', 'audio/wave'];
const TranscribeQuery = z.object({
  lang: z
    .string()
    .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/)
    .default('en'),
});

/** Voice input: whether this machine can transcribe, getting it ready, and turning a recording into text. */
export function voiceRoutes(app: FastifyInstance, c: Container): void {
  app.addContentTypeParser(
    WAV_TYPES,
    { parseAs: 'buffer', bodyLimit: MAX_VOICE_BYTES },
    (_request, body, done) => done(null, body),
  );

  app.get('/api/voice/status', () => c.voice.status());

  // Starts the download of the engine and the model (a large one); progress is in the status.
  app.post('/api/voice/prepare', () => c.voice.prepare());

  app.post('/api/voice/transcribe', { bodyLimit: MAX_VOICE_BYTES }, async (request) => {
    const { lang } = parseWith(TranscribeQuery, request.query);
    const wav = request.body;
    if (!Buffer.isBuffer(wav)) throw invalid('Send the recording as an audio/wav body');
    const check = checkWav(wav);
    if (!check.ok) throw invalid(check.reason ?? 'Not a usable recording');
    return { text: await c.voice.transcribe(wav, lang) };
  });
}
