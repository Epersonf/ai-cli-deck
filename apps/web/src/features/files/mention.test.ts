// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { draftOf, useDraft } from '../chat/draftStore';
import { useSessions } from '../sessions/sessionsStore';
import { mentionInChat, mentionPath } from './mention';

describe('mentioning a file from the explorer', () => {
  beforeEach(() => {
    useDraft.setState({ byId: {} });
    useSessions.setState({
      sessions: [{ id: 's1', cwd: '/home/u/app' } as never],
      activeId: 's1',
      view: 'files',
    });
  });

  it('uses the path inside the folder, and the absolute one above it', () => {
    expect(mentionPath('/home/u/app', 'src/a.ts')).toBe('src/a.ts');
    expect(mentionPath('/home/u/app', '../other/b.ts')).toBe('/home/u/other/b.ts');
    expect(mentionPath('/home/u/app', '../../x')).toBe('/home/x');
  });

  it('adds the mention to the draft and shows the chat', () => {
    useDraft.getState().set('s1', 'look at');
    mentionInChat('s1', 'src/a b.ts', 'Added');
    expect(draftOf('s1')(useDraft.getState())).toBe('look at @"src/a b.ts" ');
    expect(useSessions.getState().view).toBe('chat');
  });
});
