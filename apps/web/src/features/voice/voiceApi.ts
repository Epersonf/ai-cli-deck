import { TOKEN_HEADER } from '@deck/shared';
import { z } from 'zod';
import { API_BASE } from '../../shared/api/base';
import { request } from '../../shared/api/client';
import { getToken } from '../../shared/api/token';

const StatusSchema = z.object({
  supported: z.boolean(),
  ready: z.boolean(),
  downloading: z.boolean(),
});
export type VoiceStatus = z.infer<typeof StatusSchema>;

export const voiceApi = {
  status: () => request(StatusSchema, 'GET', '/api/voice/status'),
  /** Downloads the speech model on the deck's machine; poll `status` for the end. */
  prepare: () => request(StatusSchema, 'POST', '/api/voice/prepare'),
  /** The text said in a 16 kHz mono WAV, in the language `lang`. */
  async transcribe(wav: Blob, lang: string): Promise<string> {
    const headers: Record<string, string> = { 'content-type': 'audio/wav' };
    const token = getToken();
    if (token !== null) headers[TOKEN_HEADER] = token;
    const response = await fetch(
      `${API_BASE}/api/voice/transcribe?lang=${encodeURIComponent(lang)}`,
      {
        method: 'POST',
        headers,
        body: wav,
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? response.statusText);
    }
    return z.object({ text: z.string() }).parse(await response.json()).text;
  },
};
