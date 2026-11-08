// @vitest-environment jsdom
import type { Session, Task } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { toWatch } from './autoNotify';

const session = (id: string, over: Partial<Session> = {}): Session =>
  ({ id, provider: 'claude', status: 'running', parentId: null, ...over }) as Session;
const watching = (sessionId: string): Task =>
  ({ kind: 'idle', sessionId, status: 'running' }) as unknown as Task;

describe('toWatch', () => {
  it('picks running agent terminals that nobody watches yet', () => {
    const all = [session('a'), session('b'), session('c')];
    expect(toWatch(all, [watching('b')], new Set())).toEqual(['a', 'c']);
  });

  it('skips plain shells, child terminals and ended ones', () => {
    const all = [
      session('shell', { provider: 'shell' }),
      session('child', { parentId: 'a' }),
      session('done', { status: 'exited' }),
      session('ok'),
    ];
    expect(toWatch(all, [], new Set())).toEqual(['ok']);
  });

  it('does not retry one that was already tried', () => {
    expect(toWatch([session('a'), session('b')], [], new Set(['a']))).toEqual(['b']);
  });
});
