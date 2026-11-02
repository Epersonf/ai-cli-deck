import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Constant-time string comparison (hashes first so lengths never leak). */
export const safeEqual = (a: string, b: string): boolean => timingSafeEqual(digest(a), digest(b));
