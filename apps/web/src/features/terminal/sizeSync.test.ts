import { describe, expect, it } from 'vitest';
import { createSizeSync } from './sizeSync';

function setup(own = { cols: 100, rows: 30 }) {
  const term = {
    ...own,
    resize: (cols: number, rows: number) => Object.assign(term, { cols, rows }),
  };
  const sent: Array<[number, number]> = [];
  const flags: boolean[] = [];
  const fitter = { fit: () => term.resize(own.cols, own.rows) };
  const sync = createSizeSync(
    term,
    fitter,
    (c, r) => sent.push([c, r]),
    (f) => flags.push(f),
  );
  return { term, sync, sent, flags };
}

describe('size sync between devices', () => {
  it('ignores the echo of its own size', () => {
    const { sync, flags, term } = setup();
    sync.onServerSize(100, 30);
    expect(sync.following).toBe(false);
    expect(flags).toEqual([]);
    expect(term.cols).toBe(100);
  });

  it('mirrors another device’s size and does not refit or report its own', () => {
    const { sync, term, sent } = setup();
    sync.onServerSize(160, 48);
    expect(sync.following).toBe(true);
    expect([term.cols, term.rows]).toEqual([160, 48]);
    sync.fit();
    sync.sendIfOwner();
    expect([term.cols, term.rows]).toEqual([160, 48]);
    expect(sent).toEqual([]);
  });

  it('takes the size over when the user acts on it', () => {
    const { sync, term, sent, flags } = setup();
    sync.onServerSize(160, 48);
    sync.claim();
    expect(sync.following).toBe(false);
    expect([term.cols, term.rows]).toEqual([100, 30]);
    expect(sent.at(-1)).toEqual([100, 30]);
    expect(flags).toEqual([true, false]);
  });

  it('as the owner it reports its size on request', () => {
    const { sync, sent } = setup();
    sync.sendIfOwner();
    expect(sent).toEqual([[100, 30]]);
  });
});
