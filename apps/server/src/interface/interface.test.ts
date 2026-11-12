import { describe, expect, it } from 'vitest';
import { isAllowedHost, isAllowedOrigin, isLoopbackAddress, tokensMatch } from './http/guards.js';
import { eventToMessage } from './ws/messages.js';

describe('http guards', () => {
  it('only accepts same-origin or allow-listed origins', () => {
    expect(isAllowedOrigin(undefined, 'localhost:7842', [])).toBe(true);
    expect(isAllowedOrigin('http://localhost:7842', 'localhost:7842', [])).toBe(true);
    expect(isAllowedOrigin('http://evil.com', 'localhost:7842', [])).toBe(false);
    expect(isAllowedOrigin('null', 'localhost:7842', [])).toBe(false);
    expect(isAllowedOrigin('http://evil.com', 'localhost:7842', ['http://evil.com'])).toBe(true);
  });

  it('blocks non-loopback Host headers on a loopback bind', () => {
    expect(isAllowedHost('localhost:7842', true)).toBe(true);
    expect(isAllowedHost('[::1]:7842', true)).toBe(true);
    expect(isAllowedHost('evil.com', true)).toBe(false);
    expect(isAllowedHost('evil.com', false)).toBe(true);
  });

  it('compares tokens safely and detects loopback peers', () => {
    expect(tokensMatch('secret-token', 'secret-token')).toBe(true);
    expect(tokensMatch('secret-token', 'secret-tokex')).toBe(false);
    expect(tokensMatch('secret-token', undefined)).toBe(false);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('192.168.1.5')).toBe(false);
  });
});

describe('eventToMessage', () => {
  it('sends the steps of the chat, and only to that session', () => {
    const event = { t: 'turn-start' as const };
    expect(eventToMessage({ kind: 'chat', sessionId: 's1', event }, 's1')).toEqual({
      type: 'event',
      event,
    });
    expect(eventToMessage({ kind: 'chat', sessionId: 's2', event }, 's1')).toBeNull();
    expect(eventToMessage({ kind: 'busy', sessionId: 's1', busy: true }, 's1')).toEqual({
      type: 'busy',
      busy: true,
    });
    expect(
      eventToMessage({ kind: 'delta', sessionId: 's1', id: 'a', part: 'text', text: 'hi' }, 's1'),
    ).toEqual({ type: 'delta', id: 'a', kind: 'text', text: 'hi' });
  });

  it('maps preview and new-tab events', () => {
    expect(
      eventToMessage({ kind: 'preview', sessionId: 's1', url: 'http://localhost:1' }, 's1'),
    ).toEqual({
      type: 'preview-open',
      url: 'http://localhost:1',
    });
    expect(
      eventToMessage({ kind: 'new-tab', sessionId: 's1', url: 'http://localhost:1' }, 's1')?.type,
    ).toBe('new-tab');
  });
});
