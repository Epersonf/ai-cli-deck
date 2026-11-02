import { describe, expect, it } from 'vitest';
import { displayName } from './explorerPrefs';

describe('displayName', () => {
  it('drops only the last extension of files', () => {
    expect(displayName('app.test.ts', 'file', false)).toBe('app.test');
    expect(displayName('app.test.ts', 'file', true)).toBe('app.test.ts');
  });

  it('keeps dotfiles, extensionless files and folders intact', () => {
    expect(displayName('.gitignore', 'file', false)).toBe('.gitignore');
    expect(displayName('Makefile', 'file', false)).toBe('Makefile');
    expect(displayName('v1.2', 'dir', false)).toBe('v1.2');
  });
});
