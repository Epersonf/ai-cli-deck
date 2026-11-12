import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { applyEvent, type Block } from '../chat/blocks';
import { authFailed, isLoginCommand, stripAuth } from './authError';

const fold = (events: ChatEvent[]): Block[] => events.reduce(applyEvent, [] as Block[]);
const user: ChatEvent = {
  t: 'user',
  id: 'u',
  text: 'hi',
  attachments: [],
  at: '2026-01-01T00:00:00Z',
};
const end = (error: string | null): ChatEvent => ({
  t: 'turn-end',
  error,
  costUsd: null,
  durationMs: 5,
});

describe('auth failures', () => {
  it('strips the AUTH: marker for display only', () => {
    expect(stripAuth('AUTH: Not logged in')).toBe('Not logged in');
    expect(stripAuth('rate limited')).toBe('rate limited');
  });

  it('sees the marker, and the "Not logged in" text, in the newest turn only', () => {
    expect(authFailed(fold([user, end('AUTH: expired')]))).toBe(true);
    const said: ChatEvent = { t: 'text', id: 'a', text: 'Not logged in · Please run /login' };
    expect(authFailed(fold([user, said, end(null)]))).toBe(true);
    expect(authFailed(fold([user, said, end(null), { ...user, id: 'u2' }]))).toBe(false);
    expect(authFailed(fold([user, end('network down')]))).toBe(false);
  });

  it('shows a failure once when the agent said it and the turn repeats it', () => {
    const text = 'Not logged in · Please run /login';
    const blocks = fold([user, { t: 'text', id: 'a', text }, end(text)]);
    expect(blocks.map((b) => b.kind)).toEqual(['user', 'text', 'turn']);
    expect(blocks[2]).toMatchObject({ error: null });
    expect(authFailed(blocks)).toBe(true);
  });

  it('keeps /login and /logout for the app', () => {
    expect(isLoginCommand(' /login ')).toBe(true);
    expect(isLoginCommand('/logout')).toBe(true);
    expect(isLoginCommand('/login please')).toBe(false);
  });
});
