/** Bytes of the WAV header we write and read (RIFF + fmt + data chunk headers). */
const HEADER = 44;
/** 16 kHz mono PCM16 is 32,000 bytes a second: under a quarter second says nothing. */
export const MIN_AUDIO_BYTES = 8000;

export interface WavCheck {
  ok: boolean;
  /** Why it is not usable. */
  reason?: string;
}

/** True for a WAV the speech engine reads: PCM, mono, 16 kHz, 16 bits. Checked from the header alone. */
export function checkWav(wav: Buffer): WavCheck {
  if (wav.length < HEADER) return { ok: false, reason: 'Not a WAV recording' };
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE')
    return { ok: false, reason: 'Not a WAV recording' };
  const format = wav.readUInt16LE(20);
  const channels = wav.readUInt16LE(22);
  const rate = wav.readUInt32LE(24);
  const bits = wav.readUInt16LE(34);
  if (format !== 1 || channels !== 1 || rate !== 16000 || bits !== 16)
    return { ok: false, reason: 'The recording must be 16 kHz mono 16-bit PCM WAV' };
  return { ok: true };
}

/** A WAV header for `bytes` of 16 kHz mono PCM16 audio (what tests and clients without one prepend). */
export function wavHeader(bytes: number): Buffer {
  const h = Buffer.alloc(HEADER);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + bytes, 4);
  h.write('WAVEfmt ', 8, 'ascii');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(bytes, 40);
  return h;
}
