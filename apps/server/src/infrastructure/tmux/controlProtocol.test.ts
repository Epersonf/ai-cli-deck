import { describe, expect, it } from 'vitest';
import {
  ControlParser,
  quoteArg,
  sendKeysCommands,
  unescapeOutput,
  type ControlEvent,
} from './controlProtocol.js';

const parse = (...chunks: string[]): ControlEvent[] => {
  const events: ControlEvent[] = [];
  const parser = new ControlParser((event) => events.push(event));
  for (const chunk of chunks) parser.push(Buffer.from(chunk, 'latin1'));
  return events;
};
const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1');

describe('tmux control mode protocol', () => {
  it('turns %output values back into the bytes the program wrote', () => {
    expect(latin1(unescapeOutput(Buffer.from('a\\033[1mb\\015\\012\\134')))).toBe(
      'a\x1b[1mb\r\n\\',
    );
    // A backslash that is not followed by three octal digits stays as it is.
    expect(latin1(unescapeOutput(Buffer.from('x\\9')))).toBe('x\\9');
  });

  it('joins a line cut between two chunks and reports only replies to our own commands', () => {
    const events = parse(
      '%begin 1 2 0\n%end 1 2 0\n%output %0 he',
      'llo\\015\n%window-renamed @0 x\n%begin 9 9 1\nline one\n%end 9 9 1\n%exit\n',
    );
    expect(events).toEqual([
      { kind: 'output', data: Buffer.from('hello\r') },
      { kind: 'reply', reply: { ok: true, lines: [Buffer.from('line one')] } },
      { kind: 'exit' },
    ]);
  });

  it('marks a failed command, and a look-alike line does not end the reply', () => {
    expect(parse('%begin 5 6 1\n%end 0 0 1\nparse error\n%error 5 6 1\n')).toEqual([
      {
        kind: 'reply',
        reply: { ok: false, lines: [Buffer.from('%end 0 0 1'), Buffer.from('parse error')] },
      },
    ]);
  });

  it('quotes typed text so that it reaches the program byte for byte', () => {
    expect(quoteArg(`a "b" $HOME \\ #{x} ~;'`)).toBe(
      '"a \\"b\\" \\$HOME \\\\ \\043\\173x\\175 \\176\\073\\047"',
    );
    expect(quoteArg('\x1b[A\r\x7fé😀')).toBe('"\\033[A\\015\\177é😀"');
  });

  it('types NUL as a hex key, guards a leading dash, and splits long input', () => {
    expect(sendKeysCommands('=s:', '-a\0b')).toEqual([
      'send-keys -t =s: -l -- "-a"',
      'send-keys -t =s: -H 00',
      'send-keys -t =s: -l -- "b"',
    ]);
    expect(sendKeysCommands('=s:', 'x'.repeat(2500))).toHaveLength(3);
  });
});
