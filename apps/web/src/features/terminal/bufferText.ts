import type { Terminal } from '@xterm/xterm';

export type TextScope = 'screen' | 'all';

/** The terminal as plain text: what is on screen, or the screen with its whole scrollback. */
export function bufferText(term: Pick<Terminal, 'buffer'>, scope: TextScope): string {
  const buffer = term.buffer.active;
  const first = scope === 'all' ? 0 : buffer.baseY;
  const lines: string[] = [];
  for (let y = first; y < buffer.length; y += 1) {
    const line = buffer.getLine(y);
    if (!line) continue;
    const text = line.translateToString(false);
    // A row that continues the one above is the same line, only wrapped by the width.
    if (line.isWrapped && lines.length > 0) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  return lines
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}
