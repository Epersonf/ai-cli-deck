import { describe, expect, it } from 'vitest';
import { app } from '../../../testing/otpApp.js';

describe('OTP routes, signing in and switching back', () => {
  it('log in with codes: 401 with tries left, then 429 with the wait, a password is just a wrong try', async () => {
    const { send, enable, kit } = await app();
    const { secret, token } = await enable();
    const login = (body: object) => send('POST', '/api/login', { body });
    expect((await login({ password: 'secret1' })).json()).toEqual({
      error: 'Wrong code',
      triesLeft: 2,
    });
    expect((await login({ code: '000000' })).json()).toEqual({ error: 'Wrong code', triesLeft: 1 });
    expect((await login({ code: '000001' })).json()).toEqual({ error: 'Wrong code', triesLeft: 0 });
    const locked = await login({ code: kit.codeOf(secret) });
    expect(locked.statusCode).toBe(429);
    expect(locked.json()).toMatchObject({ locked: true, wait: 60 });
    expect(locked.headers['retry-after']).toBe('60');
    kit.advance(61_000);
    expect((await login({ code: kit.codeOf(secret) })).json()).toEqual({ token });
  });

  it('rotate needs a current code in OTP mode; switching back needs one and a new password', async () => {
    const { send, enable, kit } = await app();
    const { secret, token } = await enable();
    expect((await send('POST', '/api/auth/otp/rotate', { token, body: {} })).statusCode).toBe(401);
    const rotated = await send('POST', '/api/auth/otp/rotate', {
      token,
      body: { code: kit.codeOf(secret) },
    });
    expect(rotated.json()).toMatchObject({ active: true });
    const next = rotated.json().secret as string;
    expect(
      (
        await send('PUT', '/api/auth/mode', {
          token,
          body: { mode: 'static', code: kit.codeOf(next), password: 'abc' },
        })
      ).statusCode,
    ).toBe(400);
    const back = await send('PUT', '/api/auth/mode', {
      token,
      body: { mode: 'static', code: kit.codeOf(next), password: 'abcd1' },
    });
    expect(back.json()).toMatchObject({ mode: 'static', token });
    expect((await send('POST', '/api/login', { body: { password: 'abcd1' } })).json()).toEqual({
      token,
    });
  });

  it('leave static login exactly as before, and never answer a secret to a signed-out client', async () => {
    const { send } = await app();
    expect((await send('POST', '/api/login', { body: { password: 'nope' } })).json()).toEqual({
      error: 'Wrong password',
    });
    expect(
      (await send('POST', '/api/login', { body: { password: 'secret1' } })).json().token,
    ).toEqual(expect.any(String));
    expect((await send('POST', '/api/auth/otp/rotate', { body: {} })).statusCode).toBe(401);
  });
});
