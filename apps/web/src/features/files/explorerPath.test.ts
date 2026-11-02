import { describe, expect, it } from 'vitest';
import { parentOf, toAbsolute, toRelative } from './explorerPath';

describe('explorer paths', () => {
  it('joins and splits against the session folder', () => {
    expect(toAbsolute('/home/u/app', '')).toBe('/home/u/app');
    expect(toAbsolute('/home/u/app/', 'src/ui')).toBe('/home/u/app/src/ui');
    expect(toAbsolute('/', 'etc')).toBe('/etc');
    expect(toAbsolute('C:\\work', 'src\\x'.replace('\\', '/'))).toBe('C:\\work\\src\\x');
    expect(toRelative('/home/u/app', '/home/u/app/src/ui/')).toBe('src/ui');
    expect(toRelative('/home/u/app', ' /home/u/app ')).toBe('');
  });

  it('rejects folders outside the session folder', () => {
    expect(toRelative('/home/u/app', '/home/u')).toBeNull();
    expect(toRelative('/home/u/app', '/home/u/app2')).toBeNull();
    expect(toRelative('/home/u/app', '/home/u/app/../x')).toBeNull();
  });

  it('finds the parent folder', () => {
    expect(parentOf('src/ui')).toBe('src');
    expect(parentOf('src')).toBe('');
    expect(parentOf('')).toBe('');
  });
});
