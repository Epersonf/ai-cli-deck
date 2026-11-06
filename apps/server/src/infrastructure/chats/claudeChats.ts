import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HANDOVER_START,
  type ChatEntry,
  type ChatReader,
  type ChatTurn,
} from '../../domain/chat.js';
import { chatTitle, isInjected, textBlocks, toolLine } from './chatText.js';
import { MAX_HEAD_LINES, dateOf, jsonLines, obj, perFile, str, type Json } from './jsonLines.js';

const MAX_LISTED = 100;
const EXT = '.jsonl';

/** Claude Code keeps a folder's chats in `<home>/projects/<the path, every other character a dash>`. */
export const claudeProjectDir = (home: string, cwd: string): string =>
  join(home, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));

/**
 * The message of a line of the conversation itself: not a sub-agent's, not a note the CLI added, not an
 * API error it shows as the assistant's answer.
 */
const message = (line: Json): Json | null =>
  (line.type === 'user' || line.type === 'assistant') &&
  !line.isSidechain &&
  !line.isMeta &&
  !line.isApiErrorMessage
    ? obj(line.message)
    : null;

/** What the user typed, or null for tool results and text the CLI injected. */
function typed(line: Json): string | null {
  if (line.type !== 'user') return null;
  const text = textBlocks(message(line)?.content, ['text']).join('\n');
  return text.trim() === '' || isInjected(text) ? null : text;
}

const remember = perFile<ChatEntry | null>();

/** A chat as listed: its first request and when it started, read from its first lines only. */
async function entryOf(path: string, id: string): Promise<ChatEntry | null> {
  const info = await stat(path);
  return remember(path, info.mtimeMs, async () => {
    const requests: string[] = [];
    let started: string | null = null;
    let count = 0;
    for await (const line of jsonLines(path)) {
      started ??= str(line.timestamp);
      const text = typed(line);
      if (text !== null) requests.push(text);
      if ((text !== null && !text.startsWith(HANDOVER_START)) || ++count >= MAX_HEAD_LINES) break;
    }
    const title = chatTitle(requests);
    if (title === null) return null; // nothing was ever asked: not a conversation
    const startedAt = dateOf(started, info.mtime);
    return { id, path, title, startedAt, updatedAt: info.mtime };
  });
}

/** Claude Code's chats: one JSON-lines file per conversation, named by its id. */
export const claudeChats: ChatReader = {
  async list(home, cwd) {
    const dir = claudeProjectDir(home, cwd);
    let names: string[];
    try {
      names = (await readdir(dir)).filter((name) => name.endsWith(EXT));
    } catch {
      return []; // never used in this folder
    }
    const files = await Promise.all(
      names.map(async (name) => {
        const info = await stat(join(dir, name)).catch(() => null);
        return { name, mtime: info?.mtimeMs ?? 0 };
      }),
    );
    files.sort((a, b) => b.mtime - a.mtime);
    const entries = await Promise.all(
      files
        .slice(0, MAX_LISTED)
        .map((f) => entryOf(join(dir, f.name), f.name.slice(0, -EXT.length)).catch(() => null)),
    );
    return entries.filter((entry): entry is ChatEntry => entry !== null);
  },

  async read(entry) {
    const turns: ChatTurn[] = [];
    for await (const line of jsonLines(entry.path)) {
      const user = typed(line);
      if (user !== null) turns.push({ role: 'user', text: user });
      if (line.type !== 'assistant') continue;
      const content = message(line)?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content.map(obj)) {
        const text = str(block?.text);
        if (block?.type === 'text' && text?.trim()) turns.push({ role: 'assistant', text });
        if (block?.type === 'tool_use')
          turns.push({ role: 'tool', text: toolLine(str(block.name) ?? 'tool', block.input) });
      }
    }
    return turns;
  },
};
