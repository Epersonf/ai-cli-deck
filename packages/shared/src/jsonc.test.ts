import { describe, expect, it } from 'vitest';
import { parseJsonc } from './jsonc.js';

describe('parseJsonc', () => {
  it('accepts comments and trailing commas', () => {
    const text = `{
      // a line comment
      "a": 1, /* a block
      comment */ "b": [1, 2,],
    }`;
    expect(parseJsonc(text)).toEqual({ a: 1, b: [1, 2] });
  });

  it('leaves comment markers, commas and escapes inside strings alone', () => {
    const text =
      '{"url": "https://x.dev/a//b", "t": "/* not */", "q": "say \\"hi\\", ]", "c": "a,}"}';
    expect(parseJsonc(text)).toEqual({
      url: 'https://x.dev/a//b',
      t: '/* not */',
      q: 'say "hi", ]',
      c: 'a,}',
    });
  });

  it('still rejects what is not JSON, and ignores a BOM', () => {
    expect(() => parseJsonc('{"a": }')).toThrow(SyntaxError);
    expect(parseJsonc('﻿{"a": 1}')).toEqual({ a: 1 });
  });
});
