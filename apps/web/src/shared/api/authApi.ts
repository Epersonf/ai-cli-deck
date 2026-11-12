import {
  AuthStatusSchema,
  LoginResponseSchema,
  OtpSetupSchema,
  type LoginBodySchema,
  type SetAuthModeBody,
} from '@deck/shared';
import { z } from 'zod';
import { ApiError, request } from './client';
import { setToken } from './token';

const ModeChangedSchema = AuthStatusSchema.extend({ token: z.string().nullable().optional() });

type LoginBody = z.input<typeof LoginBodySchema>;

/** Signing in and the access mode (static password or one-time code). */
export const authApi = {
  status: () => request(AuthStatusSchema, 'GET', '/api/auth'),
  login: (body: LoginBody) => request(LoginResponseSchema, 'POST', '/api/login', body),
  /** The secret, QR link and current code; only for a signed-in device. */
  otp: () => request(OtpSetupSchema, 'GET', '/api/auth/otp'),
  /** A new secret; the current code is needed while OTP is active. */
  rotate: (code: string | null) =>
    request(OtpSetupSchema, 'POST', '/api/auth/otp/rotate', code === null ? {} : { code }),
  /** Switching mode can hand out a new access token (after a switch to OTP): it replaces the old one. */
  setMode: (body: SetAuthModeBody) =>
    request(ModeChangedSchema, 'PUT', '/api/auth/mode', body).then((changed) => {
      if (typeof changed.token === 'string') setToken(changed.token);
      return changed;
    }),
};

/** Why a sign-in failed: a wrong code (tries left), a lock (seconds to wait), the server, or no network. */
export type LoginFailure =
  | { kind: 'wrong'; triesLeft: number }
  | { kind: 'locked'; wait: number }
  | { kind: 'other'; message: string }
  | { kind: 'offline' };

const TriesSchema = z.object({ triesLeft: z.number() });
const WaitSchema = z.object({ wait: z.number() });

export function loginFailure(error: unknown): LoginFailure {
  if (!(error instanceof ApiError)) return { kind: 'offline' };
  const locked = WaitSchema.safeParse(error.data);
  if (error.status === 429 && locked.success) return { kind: 'locked', wait: locked.data.wait };
  const tries = TriesSchema.safeParse(error.data);
  if (error.status === 401 && tries.success) {
    return { kind: 'wrong', triesLeft: tries.data.triesLeft };
  }
  return { kind: 'other', message: error.message };
}
