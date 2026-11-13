import { beforeEach, describe, expect, it } from 'vitest';
import { draftOf, useDraft } from './draftStore';

describe('chat drafts', () => {
  beforeEach(() => useDraft.setState({ byId: {} }));

  it('keeps one draft per chat', () => {
    useDraft.getState().set('a', 'hello');
    useDraft.getState().set('b', 'other');
    expect(draftOf('a')(useDraft.getState())).toBe('hello');
    expect(draftOf('b')(useDraft.getState())).toBe('other');
    expect(draftOf('c')(useDraft.getState())).toBe('');
  });

  it('inserts a mention with one space around it', () => {
    const { insert, set } = useDraft.getState();
    insert('a', '@x.ts');
    expect(draftOf('a')(useDraft.getState())).toBe('@x.ts ');
    set('a', 'look at');
    insert('a', '@y.ts');
    expect(draftOf('a')(useDraft.getState())).toBe('look at @y.ts ');
    insert('a', '@z.ts');
    expect(draftOf('a')(useDraft.getState())).toBe('look at @y.ts @z.ts ');
  });
});
