import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonLimitStore } from '../infrastructure/store/JsonLimitStore.js';
import { LimitBook } from './LimitBook.js';

const later = (ms: number): string => new Date(Date.now() + ms).toISOString();

describe('the accounts usage windows', () => {
  it('keeps the last window per account across restarts, and tells who listens', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-limits-'));
    try {
      const store = new JsonLimitStore(join(dir, 'limits.json'));
      const first = new LimitBook(store);
      const told: string[] = [];
      first.onChange((account) => told.push(account));
      first.set('claude', {
        key: 'five_hour',
        used: 0.5,
        resetsAt: later(60_000),
        label: '5-hour limit',
      });
      first.set('claude', {
        key: 'seven_day',
        used: 0.2,
        resetsAt: later(120_000),
        label: 'Weekly limit',
      });
      expect(told).toEqual(['claude', 'claude']);
      const second = new LimitBook(store);
      await second.restore();
      expect(second.get('claude').map((l) => [l.key, l.used])).toEqual([
        ['five_hour', 0.5],
        ['seven_day', 0.2],
      ]);
      expect(second.get('other')).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('starts empty when nothing was saved or the file is broken', async () => {
    const book = new LimitBook({
      load: () => Promise.reject(new Error('unreadable')),
      save: () => Promise.resolve(),
    });
    await book.restore();
    expect(book.get('claude')).toEqual([]);
  });

  it('reads the file of older versions, which kept one unnamed window per account', async () => {
    const book = new LimitBook({
      load: () =>
        Promise.resolve({ claude: { used: 0.3, resetsAt: later(60_000), label: 'Weekly' } }),
      save: () => Promise.resolve(),
    });
    await book.restore();
    expect(book.get('claude')).toMatchObject([{ key: 'Weekly', used: 0.3 }]);
  });

  it('replaces a window by its key and drops the ones that reset', () => {
    const book = new LimitBook();
    book.set('a', { key: 'five_hour', used: 0.1, resetsAt: later(60_000), label: null });
    book.set('a', { key: 'five_hour', used: 0.4, resetsAt: later(60_000), label: null });
    book.set('a', { key: 'seven_day', used: 0.9, resetsAt: later(-1000), label: null });
    expect(book.get('a').map((l) => [l.key, l.used])).toEqual([['five_hour', 0.4]]);
  });
});
