import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { AuthService } from '../../application/AuthService.js';
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
