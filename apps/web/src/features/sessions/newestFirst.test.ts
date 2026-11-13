// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeSession } from '../../testing/fixtures';
import { newestFirst } from './sessionsStore';

const at = (id: string, lastMessageAt: string | null) => ({
  ...makeSession(id, '/w'),
  lastMessageAt,
});

describe('newestFirst', () => {
  it('puts the chat with the latest message on top', () => {
    const list = [
      at('s1', '2026-02-01T00:00:00Z'),
      at('s2', null),
      at('s3', '2026-03-01T00:00:00Z'),
    ];
    expect(newestFirst(list).map((s) => s.id)).toEqual(['s3', 's1', 's2']);
  });

  it('counts a chat nobody wrote in from its creation', () => {
    expect(newestFirst([at('s1', null), at('s2', null)]).map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('lets an old chat jump above a newer one once it gets a message', () => {
    const list = [at('s2', null), at('s1', '2026-06-01T00:00:00Z')];
    expect(newestFirst(list).map((s) => s.id)).toEqual(['s1', 's2']);
  });
});
