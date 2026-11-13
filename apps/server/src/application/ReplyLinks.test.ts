import { describe, expect, it } from 'vitest';
import { ReplyLinks } from './ReplyLinks.js';

describe('reply addresses', () => {
  it('leads to the chat it was made for, and is reused for that chat', () => {
    const links = new ReplyLinks(() => 0);
    const a = links.issue('s1');
    expect(links.issue('s1')).toBe(a);
    expect(links.issue('s2')).not.toBe(a);
    expect(links.resolve(a)).toBe('s1');
    expect(links.resolve('nope')).toBeNull();
  });

  it('expires, and is renewed by a newer notification', () => {
    let clock = 0;
    const links = new ReplyLinks(() => clock, 1000);
    const a = links.issue('s1');
    clock = 900;
    expect(links.issue('s1')).toBe(a);
    clock = 1800;
    expect(links.resolve(a)).toBe('s1');
    clock = 3000;
    expect(links.resolve(a)).toBeNull();
    expect(links.issue('s1')).not.toBe(a);
  });
});
