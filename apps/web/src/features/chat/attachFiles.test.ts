// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_BYTES, attachable, readAttachment } from './attachFiles';

const file = (name: string, type: string, body = 'hi'): File => new File([body], name, { type });

describe('attachments', () => {
  it('keeps only pictures and PDFs', () => {
    const list = [
      file('a.png', 'image/png'),
      file('b.txt', 'text/plain'),
      file('c.pdf', 'application/pdf'),
    ];
    expect(attachable(list).map((f) => f.name)).toEqual(['a.png', 'c.pdf']);
  });

  it('reads a file as base64 with its type and name', async () => {
    const result = await readAttachment(file('a.png', 'image/png', 'hi'));
    expect(result).toEqual({
      ok: true,
      image: { mediaType: 'image/png', data: 'aGk=', name: 'a.png' },
    });
  });

  it('refuses a file that is too big', async () => {
    const big = file('big.png', 'image/png', 'x'.repeat(MAX_BYTES + 1));
    expect(await readAttachment(big)).toEqual({ ok: false, name: 'big.png', why: 'size' });
  });
});
