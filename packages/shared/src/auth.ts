import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 4;

export const AuthStatusSchema = z.object({
  required: z.boolean(),
  /** True when the server only listens on this machine, so the password may be removed. */
  canDisable: z.boolean(),
  /** True while the built-in fallback password is in use. */
  isDefault: z.boolean(),
  /** `static`: a fixed password. `otp`: a 6-digit one-time code (authenticator app), see OtpSetup. */
  mode: z.enum(['static', 'otp']).default('static'),
});
export type AuthStatus = z.infer<typeof AuthStatusSchema>;

/** Static mode sends `password`; OTP mode sends `code` (6 digits). */
export const LoginBodySchema = z.object({
  password: z.string().max(256).optional(),
  code: z.string().regex(/^\d{6}$/).optional(),
});

/**
 * OTP mode: every wrong code counts per client. 3 wrong codes end a round and lock the client for 1, 5,
 * 15, then 60 minutes (it grows each round); a client with no failure for 1 hour starts over.
 * The server answers 401 `{error, triesLeft}` for a wrong code and 429 `{error, wait, locked: true}`
 * (wait in seconds) while locked.
 */
export const OTP = {
  digits: 6,
  stepSeconds: 30,
  triesPerRound: 3,
  lockMinutes: [1, 5, 15, 60],
  forgetMinutes: 60,
} as const;

/** What the person adds to an authenticator app, and the code right now (shown only to a signed-in device). */
export const OtpSetupSchema = z.object({
  /** Base32 secret (RFC 4648, no padding) for manual entry. */
  secret: z.string(),
  /** `otpauth://totp/...` for a QR code. */
  uri: z.string(),
  /** The current code and the seconds left before it changes. */
  code: z.string(),
  expiresIn: z.number().int().min(0).max(30),
  /** True when this secret is the one in use (OTP mode is on); false while it is only a pending setup. */
  active: z.boolean(),
});
export type OtpSetup = z.infer<typeof OtpSetupSchema>;

/**
 * Switch the access mode. To OTP: `code` is a valid code of the pending secret (proof that the authenticator
 * works, so nobody locks themselves out). To static: `code` is a valid current code and `password` the new
 * static password.
 */
export const SetAuthModeBodySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('otp'), code: z.string().regex(/^\d{6}$/) }),
  z.object({
    mode: z.literal('static'),
    code: z.string().regex(/^\d{6}$/),
    password: z.string().min(MIN_PASSWORD_LENGTH).max(256),
  }),
]);
export type SetAuthModeBody = z.infer<typeof SetAuthModeBodySchema>;
export const LoginResponseSchema = z.object({ token: z.string().nullable() });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** `next: null` removes the password (loopback only); `current` is needed when one is set. */
export const ChangePasswordBodySchema = z.object({
  current: z.string().max(256).nullable(),
  next: z.string().min(MIN_PASSWORD_LENGTH).max(256).nullable(),
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;
