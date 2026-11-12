import { describe, expect, it } from 'vitest';
import { LAN, app } from '../../../testing/otpApp.js';

describe('OTP routes', () => {
  it('need a signed-in device to show the secret, and the first call makes a pending one', async () => {
    const { send, kit } = await app();
    expect((await send('GET', '/api/auth/otp')).statusCode).toBe(401);
    const res = await send('GET', '/api/auth/otp', { token: kit.auth.accessToken ?? '' });
    expect(res.json()).toMatchObject({
      active: false,
      secret: expect.any(String),
      uri: expect.stringContaining('otpauth://'),
    });
    expect((await send('GET', '/api/auth')).json()).toMatchObject({
      required: true,
      mode: 'static',
    });
  });

  it('switch on with a right code, answering the status and the new token; old sessions end', async () => {
    const { send, kit, enable } = await app();
    const old = kit.auth.accessToken ?? '';
    const { res, token } = await enable();
    expect(res.json()).toMatchObject({ mode: 'otp', required: true, isDefault: false });
    expect((await send('GET', '/api/ping', { token: old })).statusCode).toBe(401);
    expect((await send('GET', '/api/ping', { token })).statusCode).toBe(200);
  });

  it('answer per client: the machine itself is exempt in OTP mode, a proxied or LAN client is not', async () => {
    const { send, enable } = await app();
    await enable();
    expect((await send('GET', '/api/auth', { from: '127.0.0.1' })).json()).toMatchObject({
      required: false,
      mode: 'otp',
    });
    expect((await send('GET', '/api/auth', { from: '::ffff:127.0.0.1' })).json().required).toBe(
      false,
    );
    expect((await send('GET', '/api/auth', { from: LAN })).json().required).toBe(true);
    expect((await send('GET', '/api/ping', { from: '127.0.0.1' })).statusCode).toBe(200);
    expect((await send('GET', '/api/ping', { from: LAN })).statusCode).toBe(401);
    expect(
      (await send('GET', '/api/ping', { from: LAN, headers: { 'x-forwarded-for': '127.0.0.1' } }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await send('GET', '/api/ping', {
          from: '127.0.0.1',
          headers: { 'x-forwarded-for': '8.8.8.8' },
        })
      ).statusCode,
    ).toBe(401);
  });
});
