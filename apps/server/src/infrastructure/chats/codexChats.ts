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
/** Chat files opened to find a folder's: every folder's chats share one dated tree. */
const MAX_SCANNED = 400;

const desc = async (dir: string): Promise<string[]> =>
  (await readdir(dir).catch(() => [] as string[])).sort().reverse();

/** Codex's chat files, newest first (`sessions/YYYY/MM/DD/rollout-<time>-<id>.jsonl`). */
async function newestFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const year of await desc(root))
    for (const month of await desc(join(root, year)))
      for (const day of await desc(join(root, year, month))) {
        const dir = join(root, year, month, day);
        for (const name of await desc(dir)) {
          if (name.endsWith('.jsonl')) files.push(join(dir, name));
          if (files.length >= MAX_SCANNED) return files;
        }
      }
  return files;
}

/** The text of a user or assistant message item, or null for anything else. */
function said(line: Json, role: 'user' | 'assistant'): string | null {
  const item = obj(line.payload);
  if (line.type !== 'response_item' || item?.type !== 'message' || item.role !== role) return null;
  const text = textBlocks(item.content, ['input_text', 'output_text', 'text']).join('\n');
  return text.trim() === '' || (role === 'user' && isInjected(text)) ? null : text;
}

const remember = perFile<ChatEntry | null>();

/** The chat a rollout holds, if it was started in `cwd` (its first line says where) and asked something. */
async function entryOf(path: string, cwd: string): Promise<ChatEntry | null> {
  const info = await stat(path);
  return remember(
    `${cwd}
${path}`,
    info.mtimeMs,
    async () => {
      let meta: Json | null = null;
      const requests: string[] = [];
      let count = 0;
      for await (const line of jsonLines(path)) {
        if (count++ === 0) {
          meta = line.type === 'session_meta' ? obj(line.payload) : null;
          if (!meta || meta.cwd !== cwd) return null;
          if (meta.source === 'exec' || meta.originator === 'codex_exec') return null; // no chat
          continue;
        }
        const text = said(line, 'user');
        if (text !== null) requests.push(text);
        if ((text !== null && !text.startsWith(HANDOVER_START)) || count >= MAX_HEAD_LINES) break;
      }
      const title = chatTitle(requests);
      const id = str(meta?.id) ?? str(meta?.session_id);
      if (title === null || !id) return null;
      const startedAt = dateOf(meta?.timestamp, info.mtime);
      return { id, path, title, startedAt, updatedAt: info.mtime };
    },
  );
}

/** A tool call item as one line. */
function toolOf(line: Json): string | null {
  const item = obj(line.payload);
  if (line.type !== 'response_item' || !item) return null;
  const name = str(item.name) ?? 'tool';
  if (item.type === 'function_call') {
    const args = str(item.arguments) ?? '';
    try {
      return toolLine(name, JSON.parse(args));
    } catch {
      return toolLine(name, args);
    }
  }
  if (item.type === 'custom_tool_call') return toolLine(name, item.input);
  if (item.type === 'local_shell_call') return toolLine('shell', obj(item.action));
  return null;
}

/** Codex's chats ("rollouts"), found by the folder recorded at their start. */
export const codexChats: ChatReader = {
  async list(home, cwd) {
    const found = new Map<string, ChatEntry>();
    for (const path of await newestFiles(join(home, 'sessions'))) {
      const entry = await entryOf(path, cwd).catch(() => null);
      const known = entry ? found.get(entry.id) : undefined;
      if (entry && (!known || known.updatedAt < entry.updatedAt)) found.set(entry.id, entry);
      if (found.size >= MAX_LISTED) break;
    }
    return [...found.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  },

  async read(entry) {
    const turns: ChatTurn[] = [];
    for await (const line of jsonLines(entry.path)) {
      const user = said(line, 'user');
      const answer = said(line, 'assistant');
      const tool = toolOf(line);
      if (user !== null) turns.push({ role: 'user', text: user });
      if (answer !== null) turns.push({ role: 'assistant', text: answer });
      if (tool !== null) turns.push({ role: 'tool', text: tool });
    }
    return turns;
  },
};
