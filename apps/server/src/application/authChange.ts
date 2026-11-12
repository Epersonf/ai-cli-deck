import type { AuthMode, StoredAuth } from '../domain/auth.js';

/** Changes to how people sign in, saved together. */
export interface AuthChange {
  mode?: AuthMode;
  otp?: string | null;
  pendingOtp?: string | null;
  /** A new static password (replaces the old one). */
  password?: string;
  /** Hand out a new access token: devices signed in with the old one are signed out. */
  newToken?: boolean;
}

export type SavedModes = Pick<StoredAuth, 'mode' | 'otp' | 'pendingOtp'>;

const secretOf = (given: string | null | undefined, kept: { secret: string } | null) =>
  given === undefined ? kept : given === null ? null : { secret: given };

/** The mode and secrets after a change. */
export const applyModes = (saved: SavedModes, change: AuthChange): SavedModes => ({
  mode: change.mode ?? saved.mode,
  otp: secretOf(change.otp, saved.otp),
  pendingOtp: secretOf(change.pendingOtp, saved.pendingOtp),
});
