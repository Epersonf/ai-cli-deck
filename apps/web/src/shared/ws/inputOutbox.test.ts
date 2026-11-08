import { describe, expect, it } from 'vitest';
import { createOutbox } from './inputOutbox';

describe('input outbox', () => {
  it('keeps input until it is acknowledged, in order', () => {
    const box = createOutbox(1000, () => 0);
    box.add('a');
    box.add('b');
    box.add('c');
    box.ack(2);
    expect(box.pending().map((item) => item.data)).toEqual(['c']);
  });

  it('numbers keep growing so a resend is the same number', () => {
    const box = createOutbox(1000, () => 0);
    expect(box.add('a')).toBe(1);
    expect(box.add('b')).toBe(2);
    expect(box.pending().map((item) => item.seq)).toEqual([1, 2]);
    expect(box.pending().map((item) => item.seq)).toEqual([1, 2]);
  });

  it('drops input that waited too long', () => {
    let clock = 0;
    const box = createOutbox(1000, () => clock);
    box.add('old');
    clock = 1500;
    box.add('new');
    expect(box.pending().map((item) => item.data)).toEqual(['new']);
  });
});
