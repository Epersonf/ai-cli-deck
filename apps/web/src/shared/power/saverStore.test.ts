// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isSaving } from './saverStore';

describe('isSaving', () => {
  it('auto saves in the Android app or on a low battery', () => {
    expect(isSaving('auto', false, true)).toBe(true);
    expect(isSaving('auto', true, false)).toBe(true);
    expect(isSaving('auto', false, false)).toBe(false);
  });

  it('on and off ignore the surroundings', () => {
    expect(isSaving('on', false, false)).toBe(true);
    expect(isSaving('off', true, true)).toBe(false);
  });
});
