import { AuthService } from '../application/AuthService.js';
import { OtpAccess } from '../application/OtpAccess.js';
import { OtpThrottle } from '../application/OtpThrottle.js';
import type { AuthStorePort, PasswordHasherPort, StoredAuth } from '../domain/auth.js';
import { totpCode } from '../domain/totp.js';

export class MemoryAuthStore implements AuthStorePort {
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

/** Auth with a static password `secret1` (or none), a controllable clock, and OTP on top of it. */
export async function otpKit(options: { loopback?: boolean; password?: string | null } = {}) {
  let now = 1_700_000_000_000;
  let counter = 0;
  let secrets = 0;
  const store = new MemoryAuthStore();
  const auth = await AuthService.create({
    store,
    hasher,
    newToken: () => `token-${(counter += 1)}-xxxxxxxxxxxx`,
    loopback: options.loopback ?? false,
    envPassword: options.password === undefined ? 'secret1' : options.password,
  });
  const otp = new OtpAccess({
    auth,
    throttle: new OtpThrottle(() => now),
    now: () => now,
    newSecret: () =>
      `SECRET${(secrets += 1)}AAAAAAAAAAAAAAAAAAAAAAAAAAAAA`.slice(0, 32).replace(/[0189]/g, 'A'),
    label: () => 'Deck',
  });
  return {
    auth,
    otp,
    store,
    advance: (ms: number) => (now += ms),
    codeOf: (secret: string, stepOffset = 0) => totpCode(secret, now + stepOffset * 30_000),
  };
}
