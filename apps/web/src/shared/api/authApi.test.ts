// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loginFailure } from './authApi';
import { ApiError } from './client';

describe('loginFailure', () => {
  it('reads the tries left of a wrong code', () => {
    const error = new ApiError(401, 'Wrong code', { error: 'Wrong code', triesLeft: 2 });
    expect(loginFailure(error)).toEqual({ kind: 'wrong', triesLeft: 2 });
  });

  it('reads the wait of a lock', () => {
    const error = new ApiError(429, 'Locked', { error: 'Locked', wait: 75, locked: true });
    expect(loginFailure(error)).toEqual({ kind: 'locked', wait: 75 });
  });

  it('keeps the message of any other refusal', () => {
    expect(loginFailure(new ApiError(401, 'Wrong password'))).toEqual({
      kind: 'other',
      message: 'Wrong password',
    });
  });

  it('treats a network failure as offline', () => {
    expect(loginFailure(new TypeError('failed to fetch'))).toEqual({ kind: 'offline' });
  });
});
