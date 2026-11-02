import { describe, expect, it } from 'vitest';
import type { AuthStorePort, PasswordHasherPort, StoredAuth } from '../domain/auth.js';
import { AuthService, chooseAuthSource } from './AuthService.js';

class MemoryStore implements AuthStorePort {
  saved: StoredAuth | null = null;
  load = () => Promise.resolve(this.saved);
  save = (auth: StoredAuth) => {
    this.saved = auth;
    return Promise.resolve();
  };
}

const hasher: PasswordHasherPort = {
  hash: (password) => ({ salt: 's', hash: `h:${password}` }),
  verify: (password, stored) => stored.hash === `h:${password}`,
};

function make(store: MemoryStore, loopback: boolean, envPassword: string | null = null) {
  let counter = 0;
  const newToken = () => `token-${(counter += 1)}-xxxxxxxxxxxx`;
  return AuthService.create({ store, hasher, newToken, loopback, envPassword });
}

describe('chooseAuthSource', () => {
  const none = { loopback: true, stored: null, envPassword: null };
  it('stays open on loopback and falls back to the default beyond it', () => {
    expect(chooseAuthSource(none)).toBe('none');
    expect(chooseAuthSource({ ...none, loopback: false })).toBe('default');
  });

  it('prefers a stored password, then env', () => {
    const stored = { kind: 'password' as const, salt: 's', hash: 'h' };
    expect(chooseAuthSource({ ...none, stored, envPassword: 'env1' })).toBe('stored');
    expect(chooseAuthSource({ ...none, envPassword: 'env1' })).toBe('env');
  });

  it('honours "no password" on loopback only', () => {
    const stored = { kind: 'none' as const };
    expect(chooseAuthSource({ ...none, stored, envPassword: 'env1' })).toBe('none');
    expect(chooseAuthSource({ loopback: false, stored, envPassword: null })).toBe('default');
  });
});

describe('AuthService', () => {
  it('needs no password on loopback and accepts any token', async () => {
    const auth = await make(new MemoryStore(), true);
    expect(auth).toMatchObject({ required: false, accessToken: null, canDisable: true });
    expect(auth.isValidToken(undefined)).toBe(true);
  });

  it('requires the default password beyond loopback and cannot disable it', async () => {
    const auth = await make(new MemoryStore(), false);
    expect(auth).toMatchObject({ required: true, isDefault: true, canDisable: false });
    expect(auth.verifyPassword('deck')).toBe(true);
    expect(auth.verifyPassword('nope')).toBe(false);
    expect(auth.isValidToken(undefined)).toBe(false);
    expect(auth.isValidToken(auth.accessToken ?? '')).toBe(true);
    await expect(auth.change('deck', null)).rejects.toThrow('mandatory');
  });

  it('changes the password, rotates the token and persists the hash', async () => {
    const store = new MemoryStore();
    const auth = await make(store, false, 'env-pass');
    const before = auth.accessToken;
    await expect(auth.change('wrong', 'new-pass')).rejects.toThrow('Current password is wrong');
    const token = await auth.change('env-pass', 'new-pass');
    expect(token).not.toBe(before);
    expect(auth.isValidToken(before ?? '')).toBe(false);
    expect(auth.verifyPassword('new-pass')).toBe(true);
    expect(store.saved?.password).toEqual({ kind: 'password', salt: 's', hash: 'h:new-pass' });
    const restarted = await make(store, false, 'env-pass');
    expect(restarted.verifyPassword('new-pass')).toBe(true);
    expect(restarted.isDefault).toBe(false);
  });

  it('rejects passwords that are too short', async () => {
    const auth = await make(new MemoryStore(), true);
    await expect(auth.change(null, 'abc')).rejects.toThrow('at least');
  });

  it('sets a password from open mode and removes it again on loopback', async () => {
    const store = new MemoryStore();
    const auth = await make(store, true);
    expect(await auth.change(null, 'secret1')).toBeTruthy();
    expect(auth.required).toBe(true);
    expect(await auth.change('secret1', null)).toBeNull();
    expect(auth.required).toBe(false);
    expect(store.saved?.password).toEqual({ kind: 'none' });
  });

  it('ignores a stored "no password" once the server is exposed to the network', async () => {
    const store = new MemoryStore();
    await (await make(store, true)).change(null, null);
    expect((await make(store, true)).required).toBe(false);
    const exposed = await make(store, false);
    expect(exposed).toMatchObject({ required: true, isDefault: true });
  });
});
