export interface SecretState {
  buffer: string;
  done: boolean;
  cancelled: boolean;
}

export const EMPTY_SECRET: SecretState = { buffer: '', done: false, cancelled: false };

/** Folds one chunk of raw keystrokes (or a paste) into the hidden input being typed. */
export function applySecretInput(state: SecretState, chunk: string): SecretState {
  let buffer = state.buffer;
  for (const char of chunk) {
    if (char === '\r' || char === '\n') return { buffer, done: true, cancelled: false };
    if (char === '\x03' || char === '\x04') return { buffer, done: true, cancelled: true };
    if (char === '\x7f' || char === '\b') buffer = buffer.slice(0, -1);
    else if (char >= ' ') buffer += char;
  }
  return { buffer, done: false, cancelled: false };
}

/** Prompts without echoing what is typed. Resolves null when cancelled with Ctrl+C / Ctrl+D. */
export function readSecret(
  prompt: string,
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
): Promise<string | null> {
  return new Promise((resolve) => {
    stdout.write(prompt);
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    let state = EMPTY_SECRET;
    const onData = (chunk: string): void => {
      state = applySecretInput(state, chunk);
      if (!state.done) return;
      stdin.off('data', onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write('\n');
      resolve(state.cancelled ? null : state.buffer);
    };
    stdin.on('data', onData);
  });
}
