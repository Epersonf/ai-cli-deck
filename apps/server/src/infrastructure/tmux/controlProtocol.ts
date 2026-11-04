/**
 * tmux control mode (`tmux -C`) speaks in lines. `%output %<pane> <value>` carries the program's own bytes,
 * with every byte below 32 and the backslash written as three octal digits (`\033`); the reply to each
 * command sits between `%begin <guard>` and `%end <guard>` (or `%error <guard>`).
 */

const NEWLINE = 0x0a;
const RETURN = 0x0d;
const SPACE = 0x20;
const PERCENT = 0x25;
const BACKSLASH = 0x5c;

const octal = (byte: number | undefined): number =>
  byte !== undefined && byte >= 0x30 && byte <= 0x37 ? byte - 0x30 : -1;

/** The raw bytes behind a `%output` value. */
export function unescapeOutput(value: Uint8Array): Uint8Array {
  const out = Buffer.allocUnsafe(value.length);
  let size = 0;
  for (let i = 0; i < value.length; i += 1) {
    const byte = value[i] ?? 0;
    const [a, b, c] = [octal(value[i + 1]), octal(value[i + 2]), octal(value[i + 3])];
    if (byte === BACKSLASH && a >= 0 && b >= 0 && c >= 0) {
      out[size] = a * 64 + b * 8 + c;
      i += 3;
    } else out[size] = byte;
    size += 1;
  }
  return out.subarray(0, size);
}

/**
 * `text` as one double-quoted tmux argument that reaches the program byte for byte: quotes, `$` and the
 * backslash are escaped, control characters and anything tmux might read as syntax become octal.
 */
export function quoteArg(text: string): string {
  let out = '"';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\\' || ch === '"' || ch === '$') out += `\\${ch}`;
    else if (code < 0x20 || code === 0x7f || "#~;'{}".includes(ch)) {
      out += `\\${code.toString(8).padStart(3, '0')}`;
    } else out += ch;
  }
  return `${out}"`;
}

/** Characters per `send-keys` command, so a big paste never makes one huge line. */
const KEYS_PER_COMMAND = 1024;

/** The commands that type `data` into `target`. NUL cannot be quoted, so it goes as a hex key. */
export function sendKeysCommands(target: string, data: string): string[] {
  const commands: string[] = [];
  let run = '';
  const flush = (): void => {
    if (run !== '') commands.push(`send-keys -t ${target} -l -- ${quoteArg(run)}`);
    run = '';
  };
  for (const ch of data) {
    if (ch === '\0') {
      flush();
      commands.push(`send-keys -t ${target} -H 00`);
      continue;
    }
    run += ch;
    if (run.length >= KEYS_PER_COMMAND) flush();
  }
  flush();
  return commands;
}

export interface Reply {
  ok: boolean;
  lines: Buffer[];
}

export type ControlEvent =
  { kind: 'output'; data: Uint8Array } | { kind: 'reply'; reply: Reply } | { kind: 'exit' };

/** Turns tmux's control-mode stream into events; a line cut between two chunks waits for the next one. */
export class ControlParser {
  private rest: Buffer = Buffer.alloc(0);
  private block: { guard: string; lines: Buffer[]; ours: boolean } | null = null;

  constructor(private readonly emit: (event: ControlEvent) => void) {}

  push(chunk: Buffer): void {
    const data = this.rest.length > 0 ? Buffer.concat([this.rest, chunk]) : chunk;
    let start = 0;
    for (let end = data.indexOf(NEWLINE); end !== -1; end = data.indexOf(NEWLINE, start)) {
      this.line(data.subarray(start, data[end - 1] === RETURN ? end - 1 : end));
      start = end + 1;
    }
    this.rest = Buffer.from(data.subarray(start));
  }

  private line(line: Buffer): void {
    if (this.block) return this.blockLine(this.block, line);
    if (line[0] !== PERCENT) return;
    const space = line.indexOf(SPACE);
    const name = line.toString('latin1', 0, space === -1 ? line.length : space);
    if (name === '%output') {
      const value = line.indexOf(SPACE, space + 1);
      if (value !== -1)
        this.emit({ kind: 'output', data: unescapeOutput(line.subarray(value + 1)) });
    } else if (name === '%begin') {
      const guard = line.toString('latin1', space + 1);
      // The last field is 1 for a command this client sent (0 for the ones given on tmux's command line).
      this.block = { guard, lines: [], ours: guard.endsWith(' 1') };
    } else if (name === '%exit') this.emit({ kind: 'exit' });
  }

  private blockLine(block: { guard: string; lines: Buffer[]; ours: boolean }, line: Buffer): void {
    if (line[0] === PERCENT) {
      const text = line.toString('latin1');
      const ok = text === `%end ${block.guard}`;
      if (ok || text === `%error ${block.guard}`) {
        this.block = null;
        if (block.ours) this.emit({ kind: 'reply', reply: { ok, lines: block.lines } });
        return;
      }
    }
    block.lines.push(Buffer.from(line));
  }
}
