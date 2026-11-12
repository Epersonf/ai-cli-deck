import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Emoji and pictograph characters are forbidden in the UI: every picture is a vector icon (shared/ui).
 * Plain typography (· … – — and the arrows ← ↑ → ↓) is fine. Built from code points so the file itself has none.
 */
const BLOCKS: [number, number][] = [
  [0x21a0, 0x21ff],
  [0x2300, 0x23ff],
  [0x2440, 0x24ff],
  [0x25a0, 0x27bf],
  [0x27f0, 0x27ff],
  [0x2900, 0x2bff],
];
const inBlocks = (code: number): boolean => BLOCKS.some(([from, to]) => code >= from && code <= to);
const EMOJI = new RegExp('\\p{Extended_Pictographic}', 'u');
const isPictograph = (char: string): boolean =>
  EMOJI.test(char) || inBlocks(char.codePointAt(0) ?? 0) || char === String.fromCodePoint(0xfe0f);

const found = (text: string): string[] => [...text].filter(isPictograph);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

describe('no pictographs in the UI', () => {
  it('catches the characters it is about', () => {
    expect(found(`a ${String.fromCodePoint(0x1f4cc)} b`)).toHaveLength(1);
    expect(found(String.fromCodePoint(0x2699, 0x2715, 0x2442))).toHaveLength(3);
    expect(found(String.fromCodePoint(0xb7, 0x2026, 0x2192, 0x2190))).toEqual([]);
  });

  it('keeps emoji and symbol glyphs out of non-test .ts, .tsx and .css files', () => {
    const bad: string[] = [];
    for (const file of walk(root)) {
      if (!/\.(ts|tsx|css)$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const char of found(line)) {
            const code = char.codePointAt(0)?.toString(16);
            bad.push(`${file.slice(root.length)}:${index + 1} U+${code}`);
          }
        });
    }
    expect(bad).toEqual([]);
  });
});
