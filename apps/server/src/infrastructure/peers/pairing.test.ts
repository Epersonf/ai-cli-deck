import { describe, expect, it } from 'vitest';
import { signingKey } from './keys.js';
import { askPairing, showPairing, type ShownCode } from './pairing.js';
import { memoryWires } from './wire.js';

const phone = { key: signingKey(), name: 'Phone', port: null };
const pc = { key: signingKey(), name: 'PC', port: 7850 };

function showing(code: string) {
  const outcome: { paired?: string; asker?: string } = {};
  const show = (asker: { name: string }): ShownCode => {
    outcome.asker = asker.name;
    return { code, onCancel: () => undefined, done: (paired) => (outcome.paired = paired) };
  };
  return { show, outcome };
}

describe('pairing with a code', () => {
  it('pairs when the typed code is the one shown, and each side learns the other key', async () => {
    const [a, b] = memoryWires();
    const { show, outcome } = showing('482913');
    const shown = showPairing(b, pc, show);
    const ask = await askPairing(a, phone);
    expect(ask.name).toBe('PC');
    expect(ask.port).toBe(7850);
    expect(await ask.submit('482913')).toBeNull();
    const asker = await shown;
    expect(asker.key.equals(phone.key.publicKey)).toBe(true);
    expect(ask.key.equals(pc.key.publicKey)).toBe(true);
    expect(outcome).toEqual({ asker: 'Phone', paired: 'paired' });
  });

  it('allows a typo, then pairs', async () => {
    const [a, b] = memoryWires();
    const shown = showPairing(b, pc, showing('111222').show);
    const ask = await askPairing(a, phone);
    expect(await ask.submit('111223')).toEqual({ left: 2 });
    expect(await ask.submit('111222')).toBeNull();
    await expect(shown).resolves.toBeTruthy();
  });

  it('ends after too many wrong codes', async () => {
    const [a, b] = memoryWires();
    const { show, outcome } = showing('999999');
    const shown = showPairing(b, pc, show).catch((e: Error) => e.message);
    const ask = await askPairing(a, phone);
    await ask.submit('1');
    await ask.submit('2');
    await expect(ask.submit('3')).rejects.toThrow('Wrong code');
    expect(await shown).toBe('Wrong code');
    expect(outcome.paired).toBe('wrong');
  });
});
