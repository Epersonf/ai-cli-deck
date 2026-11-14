import { MEMORY_LIMITS, type MemoryEntry, type MemoryTree } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { memoryBriefing } from './memoryBriefing.js';

const note = (
  id: string,
  title: string,
  body: string,
  over: Partial<MemoryEntry> = {},
): MemoryEntry => ({
  id,
  scope: 'global',
  profileId: null,
  folderId: null,
  title,
  body,
  enabled: true,
  source: 'user',
  importedFrom: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});
const tree = (entries: MemoryEntry[], folders: MemoryTree['folders'] = []): MemoryTree => ({
  folders,
  entries,
});

describe('the memory in a briefing', () => {
  it('is empty without notes, and skips the disabled ones', () => {
    expect(memoryBriefing(tree([]), tree([]))).toBe('');
    expect(memoryBriefing(tree([note('1', 'x', 'y', { enabled: false })]), tree([]))).toBe('');
  });

  it('lists global notes then the profile ones as path/title: body', () => {
    const folders = [
      { id: 'f', scope: 'global' as const, profileId: null, name: 'Style', parentId: null },
    ];
    const text = memoryBriefing(
      tree([note('1', 'Tabs', 'use spaces', { folderId: 'f' })], folders),
      tree([note('2', 'Stack', 'pnpm')]),
    );
    expect(text).toContain('Notes for every chat:\n- Style/Tabs: use spaces');
    expect(text.indexOf('Style/Tabs')).toBeLessThan(text.indexOf('Stack: pnpm'));
  });

  it('stops at the limit and lists the rest by title with ids', () => {
    const big = 'x'.repeat(MEMORY_LIMITS.briefing - 650);
    const text = memoryBriefing(
      tree([note('1', 'A', big), note('2', 'B', 'y'.repeat(1000))]),
      tree([note('3', 'C', 'z')]),
    );
    expect(text).toContain('- A: xxx');
    expect(text).not.toContain('yyy');
    expect(text).toContain('More notes');
    expect(text).toContain('- B (id 2)');
    expect(text).toContain('- C (id 3)');
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(MEMORY_LIMITS.briefing);
  });
  it('bounds headers, unicode bodies and the index even with thousands of notes', () => {
    const entries = Array.from({ length: 2000 }, (_, i) =>
      note(String(i), `Nota ${i} 漢字`, '😀'.repeat(4000)),
    );
    const text = memoryBriefing(tree(entries), tree([]));
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(MEMORY_LIMITS.briefing);
    expect(text).toContain('offset/limit');
    expect(text).not.toContain('😀');
  });
});
