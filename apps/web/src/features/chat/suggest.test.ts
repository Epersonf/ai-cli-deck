import { describe, expect, it } from 'vitest';
import { activeToken, applyToken, mentionText } from './suggest';

describe('finding what to complete', () => {
  it('sees an @ mention at the caret, at the start or after a space', () => {
    expect(activeToken('look at @src/ap', 15)).toEqual({
      kind: 'file',
      query: 'src/ap',
      start: 8,
      end: 15,
    });
    expect(activeToken('@a', 2)).toEqual({ kind: 'file', query: 'a', start: 0, end: 2 });
    expect(activeToken('mail me@x.com', 13)).toBeNull();
  });

  it('takes the rest of the word under the caret', () => {
    expect(activeToken('see @sr/app.ts now', 7)).toMatchObject({ query: 'sr', start: 4, end: 14 });
  });

  it('reads a quoted mention with spaces', () => {
    expect(activeToken('see @"my fi', 11)).toMatchObject({
      kind: 'file',
      query: 'my fi',
      start: 4,
      end: 11,
    });
  });

  it('sees a /command only at the start, before its first space', () => {
    expect(activeToken('/mo', 3)).toEqual({ kind: 'command', query: 'mo', start: 0, end: 3 });
    expect(activeToken('/', 1)).toMatchObject({ kind: 'command', query: '' });
    expect(activeToken('/model fast', 11)).toBeNull();
    expect(activeToken('use /tmp/x', 10)).toBeNull();
  });

  it('finds nothing in plain text', () => {
    expect(activeToken('hello world', 5)).toBeNull();
    expect(activeToken('', 0)).toBeNull();
  });
});

describe('completing', () => {
  it('replaces the token and puts the caret after it', () => {
    const token = activeToken('look at @sr and more', 11);
    expect(token).not.toBeNull();
    if (!token) return;
    expect(applyToken('look at @sr and more', token, '@src/app.ts')).toEqual({
      text: 'look at @src/app.ts and more',
      caret: 20,
    });
  });

  it('quotes paths that have spaces', () => {
    expect(mentionText('a b.txt')).toBe('@"a b.txt"');
    expect(mentionText('a.txt')).toBe('@a.txt');
  });
});
