import { describe, expect, it } from 'vitest';
import { makeSession } from '../../testing/fixtures';
import { familyOf } from './family';

describe('familyOf', () => {
  const main = makeSession('s1', '/work/a');
  const child = { ...makeSession('s2', '/work/a/sub'), parentId: 's1' };
  const other = makeSession('s3', '/work/b');

  it('is the main session and its sub-terminals, whichever of them is active', () => {
    const all = [main, child, other];
    expect(familyOf(all, 's1')?.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(familyOf(all, 's2')?.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('is null for a session without sub-terminals, or when nothing is active', () => {
    expect(familyOf([main, child, other], 's3')).toBeNull();
    expect(familyOf([main], null)).toBeNull();
  });
});
