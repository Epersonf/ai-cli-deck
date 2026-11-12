/** What the speech model wants: mono, 16 kHz, 16-bit PCM in a WAV file. */
export const WAV_RATE = 16_000;

/** Linear resampling (enough for speech); the same samples come back when the rates match. */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to || samples.length === 0) return samples;
  const length = Math.max(1, Math.round((samples.length * to) / from));
  const out = new Float32Array(length);
  const step = from / to;
  for (let i = 0; i < length; i += 1) {
    const at = i * step;
    const lo = Math.floor(at);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = at - lo;
    out[i] = (samples[lo] ?? 0) * (1 - frac) + (samples[hi] ?? 0) * frac;
  }
  return out;
}

/** Averages the channels of a decoded recording into one. */
export function mixToMono(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first;
  const out = new Float32Array(first.length);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = channels.reduce((sum, channel) => sum + (channel[i] ?? 0), 0) / channels.length;
  }
  return out;
}

/** A 16-bit PCM WAV file (44-byte header) holding `samples` at `rate`. */
export function encodeWav(samples: Float32Array, rate: number = WAV_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (at: number, value: string): void =>
    [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return buffer;
}

/** A recorded blob (webm, ogg, mp4...) as the 16 kHz mono WAV the server transcribes. */
export async function recordingToWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
      decoded.getChannelData(i),
    );
    const mono = resample(mixToMono(channels), decoded.sampleRate, WAV_RATE);
    return new Blob([encodeWav(mono)], { type: 'audio/wav' });
  } finally {
    void context.close();
  }
}
