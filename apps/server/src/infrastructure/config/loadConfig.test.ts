import { describe, expect, it } from 'vitest';
import { mergeConfig } from './loadConfig.js';

describe('mergeConfig root folder', () => {
  it('keeps defaultCwd null when nothing is set (server falls back to the home dir)', () => {
    expect(mergeConfig({}, {}).defaultCwd).toBeNull();
  });
  it('uses defaultCwd from the config file', () => {
    expect(mergeConfig({ defaultCwd: '/srv' }, {}).defaultCwd).toBe('/srv');
  });
  it('lets DECK_ROOT override the config file', () => {
    expect(mergeConfig({ defaultCwd: '/srv' }, { DECK_ROOT: '/data' }).defaultCwd).toBe('/data');
  });
});
