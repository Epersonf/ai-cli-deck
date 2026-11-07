import { describe, expect, it } from 'vitest';
import type { Runner } from './exec.js';
import { neutralEnv } from './serverEnv.js';
import { TmuxMultiplexer } from './TmuxMultiplexer.js';

/** One single-line variable of the deck's own environment (tmux shows those too). */
const own = (): string => {
  const [key, value] = Object.entries(neutralEnv()).find(([, v]) => !v.includes('\n')) ?? [
    'A',
    'b',
  ];
  return `${key}=${value}`;
};

function fakeTmux(globalEnv: string): { run: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const run: Runner = (_command, args) => {
    calls.push(args);
    return Promise.resolve(args.includes('show-environment') ? globalEnv : '');
  };
  return { run, calls };
}

describe('TmuxMultiplexer.cleanServerEnv', () => {
  it('drops what another profile left in the tmux server, keeping the deck environment', async () => {
    const mine = own();
    const { run, calls } = fakeTmux(
      `${mine}\nPATH=/opt/deck/bin:/usr/bin\nANTHROPIC_MODEL=deepseek-chat\nANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic\n-REMOVED`,
    );
    const dropped = await new TmuxMultiplexer(run).cleanServerEnv();
    expect(dropped).toEqual(['ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL']);
    const unset = calls.find((args) => args.includes('set-environment'));
    expect(unset).toContain('ANTHROPIC_MODEL');
    expect(unset).toContain('ANTHROPIC_BASE_URL');
    expect(unset).not.toContain(mine.split('=')[0]);
  });

  it('runs nothing when the server holds nothing extra, or is not running', async () => {
    const clean = fakeTmux(own());
    expect(await new TmuxMultiplexer(clean.run).cleanServerEnv()).toEqual([]);
    expect(clean.calls.some((args) => args.includes('set-environment'))).toBe(false);

    const down: Runner = () => Promise.reject(new Error('no server running'));
    expect(await new TmuxMultiplexer(down).cleanServerEnv()).toEqual([]);
  });
});
