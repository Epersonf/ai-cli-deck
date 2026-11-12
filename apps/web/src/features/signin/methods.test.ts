import { describe, expect, it } from 'vitest';
import { methodsFor } from './methods';

describe('sign-in methods', () => {
  it('offers the account, key and machine ways per agent', () => {
    expect(methodsFor('claude', false).map((m) => m.id)).toEqual([
      'claude-account',
      'claude-console',
      'key',
      'machine',
    ]);
    expect(methodsFor('codex', false).map((m) => m.id)).toEqual([
      'codex-chatgpt',
      'key',
      'machine',
    ]);
  });

  it('gives a key-only profile just the key', () => {
    expect(methodsFor('claude', true).map((m) => m.id)).toEqual(['key']);
  });
});
