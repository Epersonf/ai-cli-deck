import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonAuthStore } from './JsonAuthStore.js';

describe('auth.json', () => {
  it('written before OTP existed still loads, as static mode', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'auth-')), 'auth.json');
    const old = { password: { kind: 'password', salt: 's', hash: 'h' }, token: 'x'.repeat(24) };
    writeFileSync(file, JSON.stringify(old));
    expect(await new JsonAuthStore(file).load()).toEqual({
      ...old,
      mode: 'static',
      otp: null,
      pendingOtp: null,
    });
  });

  it('keeps the mode and the secrets, with the static password still stored', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'auth-')), 'auth.json');
    const store = new JsonAuthStore(file);
    const auth = {
      password: { kind: 'password' as const, salt: 's', hash: 'h' },
      token: 'y'.repeat(24),
      mode: 'otp' as const,
      otp: { secret: 'ABC' },
      pendingOtp: null,
    };
    await store.save(auth);
    expect(await store.load()).toEqual(auth);
    expect(JSON.parse(readFileSync(file, 'utf8')).password.hash).toBe('h');
  });
});
