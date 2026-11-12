import { MIN_PASSWORD_LENGTH } from '@deck/shared';

export { MIN_PASSWORD_LENGTH };

/** Fallback used only when the server is exposed beyond loopback and no password was set. */
export const DEFAULT_PASSWORD = 'deck';

export interface PasswordHash {
  salt: string;
  hash: string;
}

export type StoredPassword = ({ kind: 'password' } & PasswordHash) | { kind: 'none' };

/** How people sign in: with a fixed password, or with a one-time code from an authenticator app. */
export type AuthMode = 'static' | 'otp';

export interface StoredAuth {
  /** Kept even while the mode is `otp` (unused then), so going back needs no new setup. */
  password: StoredPassword | null;
  token: string;
  mode: AuthMode;
  /** The base32 secret in use while the mode is `otp`. */
  otp: { secret: string } | null;
  /** A secret shown for setup but not yet proven with a code. */
  pendingOtp: { secret: string } | null;
}

export interface AuthStorePort {
  load(): Promise<StoredAuth | null>;
  save(auth: StoredAuth): Promise<void>;
}

export interface PasswordHasherPort {
  hash(password: string): PasswordHash;
  verify(password: string, stored: PasswordHash): boolean;
}
