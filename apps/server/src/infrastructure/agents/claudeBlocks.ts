import type { ChatEvent } from '@deck/shared';
import type { SdkMessage } from './claudeMap.js';

export interface Block {
  type?: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

const MAX_OUTPUT = 20_000;

/** Tool output as text: plain strings, or the text blocks of a structured result. */
export function outputText(content: unknown): string {
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map((part: Block) => (typeof part?.text === 'string' ? part.text : ''))
            .filter(Boolean)
            .join('\n')
        : content === undefined || content === null
          ? ''
          : JSON.stringify(content);
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n… (cut)` : text;
}

export function assistantEvents(msg: SdkMessage, offset: number): ChatEvent[] {
  const mid = msg.message?.id ?? '';
  const blocks = Array.isArray(msg.message?.content) ? (msg.message.content as Block[]) : [];
  const out: ChatEvent[] = [];
  blocks.forEach((block, n) => {
    const i = offset + n;
    if (block.type === 'text' && block.text?.trim())
      out.push({ t: 'text', id: `${mid}:${i}`, text: block.text });
    else if (block.type === 'thinking' && block.thinking?.trim())
      out.push({ t: 'thinking', id: `${mid}:${i}`, text: block.thinking });
    else if (block.type === 'tool_use' && block.id)
      out.push({ t: 'tool', id: block.id, name: block.name ?? 'tool', input: block.input });
  });
  return out;
}

export function resultEvents(msg: SdkMessage): ChatEvent[] {
  const blocks = Array.isArray(msg.message?.content) ? (msg.message.content as Block[]) : [];
  return blocks
    .filter((b) => b.type === 'tool_result' && b.tool_use_id)
    .map((b) => ({
      t: 'tool-result' as const,
      id: b.tool_use_id ?? '',
      output: outputText(b.content),
      isError: b.is_error === true,
    }));
}
