import { describe, expect, it } from 'vitest';
import { PortAllocator } from './PortAllocator.js';
import { RingBuffer } from './RingBuffer.js';
import { filterEntries } from './WorkspaceService.js';

describe('PortAllocator', () => {
  it('skips busy and reserved ports and exhausts the range', async () => {
    const busy = new Set([4100]);
    const ports = new PortAllocator({ min: 4100, max: 4102 }, (p) => Promise.resolve(!busy.has(p)));
    ports.reserve(4101);
    expect(await ports.allocate()).toBe(4102);
    await expect(ports.allocate()).rejects.toThrow('No free preview port');
    ports.release(4101);
    expect(await ports.allocate()).toBe(4101);
  });
});

describe('RingBuffer', () => {
  it('drops the oldest chunks beyond the limit but keeps the latest', () => {
    const ring = new RingBuffer(6);
    ['aaa', 'bbb', 'ccc'].forEach((s) => ring.push(Buffer.from(s)));
    expect(Buffer.from(ring.snapshot()).toString()).toBe('bbbccc');
  });
});

describe('filterEntries', () => {
  const entries = [
    { name: 'b.ts', path: 'b.ts', kind: 'file' as const },
    { name: '.git', path: '.git', kind: 'dir' as const },
    { name: 'node_modules', path: 'node_modules', kind: 'dir' as const },
    { name: 'src', path: 'src', kind: 'dir' as const },
    { name: 'a.ts', path: 'a.ts', kind: 'file' as const },
    { name: '.env', path: '.env', kind: 'file' as const },
  ];

  it('hides dotfiles and sorts dirs first', () => {
    expect(filterEntries(entries, false).map((e) => e.name)).toEqual([
      'node_modules',
      'src',
      'a.ts',
      'b.ts',
    ]);
  });

  it('shows everything when asked', () => {
    expect(filterEntries(entries, true)).toHaveLength(6);
  });
});
