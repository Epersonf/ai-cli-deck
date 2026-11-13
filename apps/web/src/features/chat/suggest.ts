/** What the person is typing that can be completed: an `@file` mention or a `/command` at the start. */
export interface Token {
  kind: 'file' | 'command';
  query: string;
  /** Where the token starts and ends in the text (the end swallows the rest of the word under the caret). */
  start: number;
  end: number;
}

export function activeToken(text: string, caret: number): Token | null {
  const before = text.slice(0, caret);
  const after = /^\S*/.exec(text.slice(caret))?.[0] ?? '';
  const command = /^\/(\S*)$/.exec(before);
  if (command)
    return { kind: 'command', query: command[1] ?? '', start: 0, end: caret + after.length };
  const mention = /(^|\s)@("[^"]*|\S*)$/.exec(before);
  if (mention) {
    const typed = mention[2] ?? '';
    return {
      kind: 'file',
      query: typed.replace(/^"/, ''),
      start: caret - typed.length - 1,
      end: caret + (typed.startsWith('"') ? 0 : after.length),
    };
  }
  return null;
}

/** The text with the token replaced, and where the caret goes (after the inserted words and a space). */
export function applyToken(
  text: string,
  token: Token,
  insertion: string,
): { text: string; caret: number } {
  const head = text.slice(0, token.start) + insertion;
  const tail = text.slice(token.end).replace(/^\s+/, '');
  return { text: `${head} ${tail}`, caret: head.length + 1 };
}

/** How a file is written in a message: `@path`, quoted when it has spaces. */
export const mentionText = (path: string): string => (/\s/.test(path) ? `@"${path}"` : `@${path}`);
