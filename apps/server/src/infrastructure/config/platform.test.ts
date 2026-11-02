import { describe, expect, it } from 'vitest';
import { resolveCwd } from '../../application/cwd.js';
import { defaultShell, pathKey, prependToPath } from './platform.js';

describe('platform helpers', () => {
  it('picks the shell per platform', () => {
    expect(defaultShell({ SHELL: '/bin/zsh' }, 'linux')).toBe('/bin/zsh');
    expect(defaultShell({}, 'linux')).toBe('bash');
    expect(defaultShell({ COMSPEC: 'C:\\Windows\\cmd.exe' }, 'win32')).toBe('C:\\Windows\\cmd.exe');
  });

  it('finds the PATH variable whatever its case', () => {
    expect(pathKey({ Path: 'x' })).toBe('Path');
    expect(pathKey({})).toBe('PATH');
  });

  it('prepends a folder using the platform delimiter', () => {
    const { key, value } = prependToPath({ PATH: '/usr/bin' }, '/deck/bin');
    expect(key).toBe('PATH');
    expect(value.startsWith('/deck/bin')).toBe(true);
    expect(value.endsWith('/usr/bin')).toBe(true);
    expect(prependToPath({}, '/deck/bin').value).toBe('/deck/bin');
  });
});

describe('resolveCwd', () => {
  it('expands ~ with either separator and trims input', () => {
    expect(resolveCwd('~', '/root')).toBe('/root');
    expect(resolveCwd('~/work', '/root/')).toBe('/root/work');
    expect(resolveCwd('~\\work', 'C:\\Users\\me')).toBe('C:\\Users\\me\\work');
    expect(resolveCwd('  /srv/app  ', '/root')).toBe('/srv/app');
    expect(resolveCwd('~user/x', '/root')).toBe('~user/x');
  });
});
