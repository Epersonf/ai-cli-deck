import type { Terminal } from '@xterm/xterm';
import { describe, expect, it } from 'vitest';
import { bufferText } from './bufferText';

type Row = { text: string; wrapped?: boolean };

function fakeTerm(rows: Row[], baseY: number): Pick<Terminal, 'buffer'> {
  const active = {
    baseY,
    length: rows.length,
    getLine: (y: number) => {
      const row = rows[y];
      return row && { isWrapped: row.wrapped === true, translateToString: () => row.text };
    },
  };
  return { buffer: { active } } as unknown as Pick<Terminal, 'buffer'>;
}

describe('bufferText', () => {
  const rows: Row[] = [
    { text: 'old line   ' },
    { text: 'npm run build and a very lo' },
    { text: 'ng command   ', wrapped: true },
    { text: '$           ' },
    { text: '            ' },
  ];

  it('returns the screen only, joining wrapped rows and dropping trailing blanks', () => {
    expect(bufferText(fakeTerm(rows, 1), 'screen')).toBe(
      'npm run build and a very long command\n$',
    );
  });

  it('returns the whole scrollback with the history scope', () => {
    expect(bufferText(fakeTerm(rows, 1), 'all')).toBe(
      'old line\nnpm run build and a very long command\n$',
    );
  });
});
