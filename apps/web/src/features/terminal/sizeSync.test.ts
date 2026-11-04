import { describe, expect, it } from 'vitest';
import { createSizeSync } from './sizeSync';

function setup(own = { cols: 100, rows: 30 }, start = own) {
  const term = {
    ...start,
    resize: (cols: number, rows: number) => Object.assign(term, { cols, rows }),
  };
  const sent: Array<[number, number]> = [];
  const flags: boolean[] = [];
  const mirrored: Array<[number, number]> = [];
  const fitter = {
    fit: () => term.resize(own.cols, own.rows),
    mirror: () => mirrored.push([term.cols, term.rows]),
    propose: () => own,
  };
  const sync = createSizeSync(
    term,
    fitter,
    (c, r) => sent.push([c, r]),
    (f) => flags.push(f),
  );
  return { term, sync, sent, flags, mirrored };
}

describe('size sync between devices', () => {
  it('after a reload, recognises its own size before it has fitted', () => {
    const { sync, flags, term } = setup({ cols: 100, rows: 30 }, { cols: 80, rows: 24 });
    sync.onServerSize(100, 30);
    expect(sync.following).toBe(false);
    expect(flags).toEqual([]);
    expect([term.cols, term.rows]).toEqual([100, 30]);
  });

  it('ignores the echo of its own size', () => {
    const { sync, flags, term } = setup();
    sync.onServerSize(100, 30);
    expect(sync.following).toBe(false);
    expect(flags).toEqual([]);
    expect(term.cols).toBe(100);
  });

  it('mirrors another device’s size, shrinking to fit, and does not refit or report its own', () => {
    const { sync, term, sent, mirrored } = setup();
    sync.onServerSize(160, 48);
    expect(sync.following).toBe(true);
    expect([term.cols, term.rows]).toEqual([160, 48]);
    sync.fit(); // the window changed: shrink again, keep the size
    sync.sendIfOwner();
    expect([term.cols, term.rows]).toEqual([160, 48]);
    expect(mirrored).toEqual([
      [160, 48],
      [160, 48],
    ]);
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
