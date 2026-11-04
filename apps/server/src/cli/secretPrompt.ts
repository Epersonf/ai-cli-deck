import { createInterface } from 'node:readline/promises';

/** Reads one line from the terminal without echoing it (an API key must not stay on screen). */
export async function askSecret(question: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) {
    // Not a terminal (piped input): nothing to hide, read a plain line.
    const rl = createInterface({ input, output: process.stdout });
    try {
      return (await rl.question(question)).trim();
    } finally {
      rl.close();
    }
  }
  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise((resolve) => {
    let typed = '';
    const finish = (): void => {
      input.setRawMode(false);
      input.pause();
      input.off('data', onData);
      process.stdout.write('\n');
      resolve(typed.trim());
    };
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') {
          typed = '';
          return finish(); // Ctrl-C: give up, the caller treats an empty key as "cancelled"
        }
        if (ch === '\u007f' || ch === '\b') typed = typed.slice(0, -1);
        else if (ch >= ' ') typed += ch;
      }
    };
    input.on('data', onData);
  });
}
