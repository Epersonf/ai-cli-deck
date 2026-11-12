import { describe, expect, it } from 'vitest';
import { encodeWav, mixToMono, resample } from './wav';

describe('wav', () => {
  it('writes a 16 kHz mono PCM16 header and the clamped samples', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]));
    const view = new DataView(wav);
    const tag = (at: number): string => String.fromCharCode(...new Uint8Array(wav, at, 4));
    expect([tag(0), tag(8), tag(36)]).toEqual(['RIFF', 'WAVE', 'data']);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([44, 46, 48, 50].map((at) => view.getInt16(at, true))).toEqual([
      0, 32767, -32768, 32767,
    ]);
  });

  it('resamples to the wanted length', () => {
    const out = resample(new Float32Array(48_000).fill(0.5), 48_000, 16_000);
    expect(out).toHaveLength(16_000);
    expect(out[100]).toBeCloseTo(0.5);
  });

  it('mixes channels to one', () => {
    expect([...mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])])]).toEqual([
      0.5, 0.5,
    ]);
  });
});
