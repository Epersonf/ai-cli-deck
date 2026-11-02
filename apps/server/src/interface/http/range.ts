export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parses a single-range `Range: bytes=a-b` header.
 * Returns null when absent or unsupported (serve the whole file) and 'invalid' when unsatisfiable.
 */
export function parseRange(header: string | undefined, size: number): ByteRange | 'invalid' | null {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart = '', rawEnd = ''] = match;
  if (rawStart === '' && rawEnd === '') return 'invalid';
  let start: number;
  let end: number;
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (size === 0 || start >= size || start > end) return 'invalid';
  return { start, end };
}
