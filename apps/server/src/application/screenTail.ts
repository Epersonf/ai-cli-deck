import { stripAnsi } from './stripAnsi.js';

/** The last few lines with real words on a terminal's screen (borders and blank rows skipped), at most `max` characters. */
export function screenTail(screen: string, lines = 3, max = 300): string {
  const words = stripAnsi(screen)
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, '').trim())
    .filter((line) => /[\p{L}\p{N}]/u.test(line));
  return words.slice(-lines).join('\n').slice(-max);
}
