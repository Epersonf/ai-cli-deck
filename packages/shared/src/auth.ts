import { z } from 'zod';

export const AuthStatusSchema = z.object({
  required: z.boolean(),
  /** True when the server only listens on this machine, so the password may be removed. */
  canDisable: z.boolean(),
  /** True while the built-in fallback password is in use. */
  isDefault: z.boolean(),
});
export type AuthStatus = z.infer<typeof AuthStatusSchema>;

export const MIN_PASSWORD_LENGTH = 4;

export const LoginBodySchema = z.object({ password: z.string().max(256) });
export const LoginResponseSchema = z.object({ token: z.string().nullable() });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** `next: null` removes the password (loopback only); `current` is needed when one is set. */
export const ChangePasswordBodySchema = z.object({
  current: z.string().max(256).nullable(),
  next: z.string().min(MIN_PASSWORD_LENGTH).max(256).nullable(),
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;
