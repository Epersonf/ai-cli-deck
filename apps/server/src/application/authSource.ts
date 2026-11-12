import type { StoredPassword } from '../domain/auth.js';

export type AuthSource = 'stored' | 'env' | 'default' | 'none';

/**
 * Where the active password comes from. A password changed in the app wins; "no password" is only
 * honoured on loopback; otherwise env/config, then the default fallback beyond loopback.
 */
export function chooseAuthSource(input: {
  loopback: boolean;
  stored: StoredPassword | null;
  envPassword: string | null;
}): AuthSource {
  if (input.stored?.kind === 'password') return 'stored';
  if (input.stored?.kind === 'none' && input.loopback) return 'none';
  if (input.envPassword !== null) return 'env';
  return input.loopback ? 'none' : 'default';
}
