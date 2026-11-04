import type { ProviderInfo, Session } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { SessionGroup } from './groupSessions';
import { filterGroups, filterSessions, matchesText } from './switcherSearch';

const group = (label: string): SessionGroup => ({ id: label, label, profile: true, sessions: [] });
const providers = [{ id: 'p1', label: 'Work' }] as unknown as ProviderInfo[];
const session = (id: string, name: string | null, cwd: string): Session =>
  ({ id, name, cwd, provider: 'p1' }) as unknown as Session;

describe('switcher search', () => {
  it('matches ignoring case and surrounding spaces; empty matches all', () => {
    expect(matchesText('Claude Work', '  WORK ')).toBe(true);
    expect(matchesText('Claude Work', 'home')).toBe(false);
    expect(matchesText('anything', '')).toBe(true);
  });

  it('filters profiles by name', () => {
    const groups = [group('Work'), group('Personal'), group('DeepSeek')];
    expect(filterGroups(groups, 'e').map((g) => g.label)).toEqual(['Personal', 'DeepSeek']);
    expect(filterGroups(groups, 'zzz')).toEqual([]);
  });

  it('filters terminals by their displayed name', () => {
    const all = [
      session('a', 'api server', '/srv/a'),
      session('b', null, '/home/me/website'),
      session('c', 'notes', '/tmp'),
    ];
    expect(filterSessions(all, providers, 'api').map((s) => s.id)).toEqual(['a']);
    expect(filterSessions(all, providers, 'website').map((s) => s.id)).toEqual(['b']);
    expect(filterSessions(all, providers, 'work').map((s) => s.id)).toEqual(['b']);
  });
});
