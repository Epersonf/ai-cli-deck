import { create } from 'qrcode';

/** The base32 secret in groups of four, easy to read out and type. */
export const formatSecret = (secret: string): string =>
  secret
    .replace(/\s/g, '')
    .replace(/(.{4})(?=.)/g, '$1 ')
    .trim();

/** 123456 becomes "123 456". */
export const formatCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

export const QUIET = 4;

/** The QR code of `text` as one SVG path of dark squares, with the quiet zone (4 modules) around it. */
export function qrPath(text: string): { size: number; d: string } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  let d = '';
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  return { size: modules.size + QUIET * 2, d };
}
