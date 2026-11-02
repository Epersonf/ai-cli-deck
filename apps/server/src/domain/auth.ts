import { MIN_PASSWORD_LENGTH } from '@deck/shared';

export { MIN_PASSWORD_LENGTH };

/** Fallback used only when the server is exposed beyond loopback and no password was set. */
export const DEFAULT_PASSWORD = 'deck';

export interface PasswordHash {
  salt: string;
  hash: string;
}

export type StoredPassword = ({ kind: 'password' } & PasswordHash) | { kind: 'none' };

export interface StoredAuth {
  password: StoredPassword | null;
  token: string;
}

export interface AuthStorePort {
  load(): Promise<StoredAuth | null>;
  save(auth: StoredAuth): Promise<void>;
}

export interface PasswordHasherPort {
  hash(password: string): PasswordHash;
  verify(password: string, stored: PasswordHash): boolean;
}
