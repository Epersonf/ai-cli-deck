import xterm from '@xterm/headless';

const { Terminal } = xterm;

/**
 * A terminal's screen as text, rendered by a headless xterm at the size the program uses: what a person
 * sees, including full-screen programs (an agent's chat), not the raw bytes with their escape codes.
 */
export async function screenText(
  bytes: Uint8Array,
  size: { cols: number; rows: number },
  lines: number,
): Promise<string> {
  const term = new Terminal({
    cols: size.cols,
    rows: size.rows,
    scrollback: 2000,
    allowProposedApi: true,
  });
  await new Promise<void>((resolve) => term.write(bytes, resolve));
  const buffer = term.buffer.active;
  const rows: string[] = [];
  for (let y = 0; y < buffer.length; y += 1)
    rows.push(buffer.getLine(y)?.translateToString(true) ?? '');
  term.dispose();
  while (rows.length > 0 && rows[rows.length - 1]?.trim() === '') rows.pop();
  return rows.slice(-lines).join('\n');
}
