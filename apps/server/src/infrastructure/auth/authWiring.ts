import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { AuthService } from '../../application/AuthService.js';
import { OtpAccess } from '../../application/OtpAccess.js';
import { OtpThrottle } from '../../application/OtpThrottle.js';
import { newSecret } from '../../domain/totp.js';
import { isLoopbackHost } from '../config/bind.js';
import { JsonAuthStore } from './JsonAuthStore.js';
import { ScryptHasher } from './ScryptHasher.js';

/** The deck's password and access token (`auth.json`), from the config and environment. */
export function createAuth(
  configDir: string,
  host: string,
  envPassword: string | null,
): Promise<AuthService> {
  return AuthService.create({
    store: new JsonAuthStore(join(configDir, 'auth.json')),
    hasher: new ScryptHasher(),
    newToken: () => randomBytes(24).toString('base64url'),
    loopback: isLoopbackHost(host),
    envPassword,
  });
}

/** One-time-code sign-in over the same credentials; an authenticator shows this machine's name. */
export const createOtp = (auth: AuthService): OtpAccess =>
  new OtpAccess({
    auth,
    throttle: new OtpThrottle(() => Date.now()),
    now: () => Date.now(),
    newSecret: () => newSecret(),
    label: () => `AI CLI Deck:${hostname()}`,
  });
