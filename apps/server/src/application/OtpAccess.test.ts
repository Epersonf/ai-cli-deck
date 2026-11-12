import { describe, expect, it } from 'vitest';
import { otpKit } from '../testing/otpKit.js';
import { OtpRefused } from './OtpAccess.js';

async function active() {
  const k = await otpKit();
  const setup = await k.otp.setup();
  await k.otp.switchMode('mode:a', { mode: 'otp', code: k.codeOf(setup.secret) });
  return { ...k, secret: setup.secret };
}
const refused = (fn: () => unknown): OtpRefused | null => {
  try {
    fn();
  } catch (e) {
    return e instanceof OtpRefused ? e : null;
  }
  return null;
};

describe('setting up one-time codes', () => {
  it('shows a pending secret (kept between calls) until a right code turns it on', async () => {
    const { auth, otp, store, codeOf } = await otpKit();
    const first = await otp.setup();
    expect(first).toMatchObject({ active: false, expiresIn: expect.any(Number) });
    expect(first.uri).toContain(`secret=${first.secret}`);
    expect((await otp.setup()).secret).toBe(first.secret);
    expect(store.saved?.pendingOtp?.secret).toBe(first.secret);
    expect((await otp.rotate('k', undefined)).secret).not.toBe(first.secret);
    const pending = auth.otpSecrets.pending ?? '';
    await expect(otp.switchMode('mode:a', { mode: 'otp', code: '000000' })).rejects.toMatchObject({
      status: 401,
      triesLeft: 2,
    });
    expect(auth.mode).toBe('static');
    await otp.switchMode('mode:a', { mode: 'otp', code: codeOf(pending) });
    expect(auth.mode).toBe('otp');
    expect(store.saved).toMatchObject({ mode: 'otp', otp: { secret: pending }, pendingOtp: null });
    expect(await otp.setup()).toMatchObject({ secret: pending, active: true });
  });

  it('signs the static sessions out when OTP turns on, but keeps the token when going back', async () => {
    const { auth, otp, codeOf } = await otpKit();
    const before = auth.accessToken;
    const { secret } = await otp.setup();
    const token = await otp.switchMode('m', { mode: 'otp', code: codeOf(secret) });
    expect(token).not.toBe(before);
    expect(auth.isValidToken(before ?? '', false)).toBe(false);
    expect(auth.isValidToken(token ?? '', false)).toBe(true);
    const back = await otp.switchMode('m', {
      mode: 'static',
      code: codeOf(secret),
      password: 'newpass',
    });
    expect(back).toBe(token);
    expect(auth.mode).toBe('static');
    expect(auth.verifyPassword('newpass')).toBe(true);
    expect(auth.otpSecrets).toEqual({ active: null, pending: null });
  });

  it('refuses to switch to the mode it is already in', async () => {
    const { otp } = await otpKit();
    await expect(
      otp.switchMode('m', { mode: 'static', code: '123456', password: 'abcd' }),
    ).rejects.toThrow(/Already/);
  });
});

describe('signing in with a code', () => {
  it('gives the token for a code of the previous, current or next step', async () => {
    const { otp, auth, secret, codeOf } = await active();
    for (const step of [-1, 0, 1])
      expect(otp.login('c', codeOf(secret, step))).toBe(auth.accessToken);
  });

  it('counts wrong codes (and a missing one), locks after three, and a right code does not pass the lock', async () => {
    const { otp, secret, codeOf, advance } = await active();
    expect(refused(() => otp.login('c', '000000'))).toMatchObject({ status: 401, triesLeft: 2 });
    expect(refused(() => otp.login('c', undefined))).toMatchObject({ status: 401, triesLeft: 1 });
    expect(refused(() => otp.login('c', 'abc'))).toMatchObject({ status: 401, triesLeft: 0 });
    expect(refused(() => otp.login('c', codeOf(secret)))).toMatchObject({ status: 429, wait: 60 });
    expect(refused(() => otp.login('other', '000000'))).toMatchObject({
      status: 401,
      triesLeft: 2,
    });
    advance(61_000);
    expect(otp.login('c', codeOf(secret))).toBeTruthy();
  });

  it('keeps the login and the mode-switch counters apart', async () => {
    const { otp } = await active();
    await expect(otp.rotate('mode:c', '000000')).rejects.toMatchObject({ triesLeft: 2 });
    expect(refused(() => otp.login('c', '000000'))).toMatchObject({ triesLeft: 2 });
  });

  it('rotates the secret only with a current code, keeping the access token', async () => {
    const { otp, auth, secret, codeOf } = await active();
    const token = auth.accessToken;
    await expect(otp.rotate('r', undefined)).rejects.toMatchObject({ status: 401 });
    const next = await otp.rotate('r', codeOf(secret));
    expect(next).toMatchObject({ active: true });
    expect(next.secret).not.toBe(secret);
    expect(auth.accessToken).toBe(token);
    expect(refused(() => otp.login('c2', codeOf(secret)))).not.toBeNull();
    expect(otp.login('c3', codeOf(next.secret))).toBe(token);
  });
});
