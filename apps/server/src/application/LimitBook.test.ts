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
      first.set('claude', { used: 0.5, resetsAt: later(60_000), label: '5-hour limit' });
      expect(told).toEqual(['claude']);
      await new Promise((resolve) => setTimeout(resolve, 30));
      const second = new LimitBook(store);
      await second.restore();
      expect(second.get('claude')).toMatchObject({ used: 0.5, label: '5-hour limit' });
      expect(second.get('other')).toBeNull();
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
    expect(book.get('claude')).toBeNull();
  });
});
