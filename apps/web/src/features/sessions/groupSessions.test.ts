import type { ProviderInfo } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { makeSession } from '../../testing/fixtures';
import { groupSessions } from './groupSessions';

const info = (id: string, profile: boolean): ProviderInfo => ({
  id,
  label: id.toUpperCase(),
  status: 'ready',
  hint: null,
  canInstall: false,
  setupId: null,
  profile,
});

describe('groupSessions', () => {
  const providers = [
    info('shell', false),
    info('claude', false),
    info('work', true),
    info('empty', true),
  ];

  it('groups terminals by profile and keeps empty user profiles', () => {
    const sessions = [makeSession('a', '/w', 'work'), makeSession('b', '/w', 'work')];
    const groups = groupSessions(providers, sessions);
    expect(groups.map((g) => [g.id, g.sessions.length])).toEqual([
      ['work', 2],
      ['empty', 0],
    ]);
  });

  it('shows a built-in CLI only while it has terminals, after the profiles', () => {
    const groups = groupSessions(providers, [makeSession('a', '/w', 'shell')]);
    expect(groups.map((g) => g.id)).toEqual(['work', 'empty', 'shell']);
  });

  it('keeps terminals whose profile no longer exists', () => {
    const groups = groupSessions(providers, [makeSession('a', '/w', 'gone')]);
    expect(groups.at(-1)).toMatchObject({ id: 'gone', label: 'gone', profile: false });
  });
});
