import { describe, expect, it } from 'vitest';
import { GitCli, parseIgnored } from './GitCli.js';

describe('git ignore marking', () => {
  it('parses NUL separated check-ignore output', () => {
    expect(parseIgnored('dist\0.env\0')).toEqual(['dist', '.env']);
    expect(parseIgnored('')).toEqual([]);
  });

  it('treats exit 1 and 128 as nothing ignored but rethrows other failures', async () => {
    const failing = (code: number) =>
      new GitCli(() => Promise.reject(Object.assign(new Error('x'), { code })));
    expect((await failing(1).ignoredPaths('/w', ['a'])).size).toBe(0);
    expect((await failing(128).ignoredPaths('/w', ['a'])).size).toBe(0);
    await expect(failing(2).ignoredPaths('/w', ['a'])).rejects.toThrow('x');
    const ok = new GitCli(() => Promise.resolve('dist\0'));
    expect([...(await ok.ignoredPaths('/w', ['dist', 'src']))]).toEqual(['dist']);
  });
});

describe('relativeTo', () => {
  it('re-bases repo-root paths onto a sub-folder and keeps outside ones', async () => {
    const { relativeTo } = await import('./GitCli.js');
    const changes = [
      { code: 'M', path: 'apps/web/a.ts' },
      { code: 'M', path: 'README.md' },
    ];
    expect(relativeTo('', changes)).toEqual(changes);
    expect(relativeTo('apps/web/', changes)).toEqual([
      { code: 'M', path: 'a.ts' },
      { code: 'M', path: 'README.md' },
    ]);
  });
});
