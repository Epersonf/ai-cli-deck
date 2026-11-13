import { describe, expect, it } from 'vitest';
import { isTop, parentOf, toAbsolute, toRelative } from './explorerPath';

describe('explorer paths', () => {
  it('joins and splits against the session folder', () => {
    expect(toAbsolute('/home/u/app', '')).toBe('/home/u/app');
    expect(toAbsolute('/home/u/app/', 'src/ui')).toBe('/home/u/app/src/ui');
    expect(toAbsolute('/', 'etc')).toBe('/etc');
    expect(toAbsolute('C:\\work', 'src\\x'.replace('\\', '/'))).toBe('C:\\work\\src\\x');
    expect(toRelative('/home/u/app', '/home/u/app/src/ui/')).toBe('src/ui');
    expect(toRelative('/home/u/app', ' /home/u/app ')).toBe('');
  });

  it('climbs above the session folder', () => {
    expect(toRelative('/home/u/app', '/home/u')).toBe('..');
    expect(toRelative('/home/u/app', '/home/u/app2')).toBe('../app2');
    expect(toRelative('/home/u/app', '/etc/x')).toBe('../../../etc/x');
    expect(toRelative('/home/u/app', 'relative/path')).toBeNull();
    expect(toAbsolute('/home/u/app', '..')).toBe('/home/u');
    expect(toAbsolute('/home/u/app', '../../x')).toBe('/home/x');
    expect(toAbsolute('C:\\work\\app', '..')).toBe('C:\\work');
  });

  it('finds the parent folder, also above the session folder', () => {
    expect(parentOf('src/ui')).toBe('src');
    expect(parentOf('src')).toBe('');
    expect(parentOf('')).toBe('..');
    expect(parentOf('..')).toBe('../..');
    expect(parentOf('../app2')).toBe('..');
  });

  it('knows the top of the file system', () => {
    expect(isTop('/home/u', '../..')).toBe(true);
    expect(isTop('/home/u', '..')).toBe(false);
    expect(isTop('C:\\work', '..')).toBe(true);
  });
});
