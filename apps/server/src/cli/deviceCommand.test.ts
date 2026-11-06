import { describe, expect, it } from 'vitest';
import { parseArgs } from './parse.js';

describe('clideck device', () => {
  it('parses the device commands', () => {
    expect(parseArgs(['devices'])).toEqual({ ok: true, command: { name: 'device', args: [] } });
    expect(parseArgs(['device', 'PC', 'run', 'dir C:\\'])).toEqual({
      ok: true,
      command: { name: 'device', args: ['PC', 'run', 'dir C:\\'] },
    });
  });

  it('asks for a device and an action', () => {
    expect(parseArgs(['device', 'PC']).ok).toBe(false);
  });
});
