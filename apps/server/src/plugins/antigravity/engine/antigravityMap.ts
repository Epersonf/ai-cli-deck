import type { AgentSink } from '../../../domain/agent.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

export const jsonList = (value: unknown): Json[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const parsed = obj(item);
        return parsed ? [parsed] : [];
      })
    : [];

/** Stream blocks in order; ACP text chunks have no ids, so give each consecutive block one. */
export class AntigravityMap {
  private block: { id: string; kind: 'text' | 'thinking'; text: string } | null = null;
  private sequence = 0;
  private readonly tools = new Set<string>();
  private readonly results = new Set<string>();

  constructor(
    private readonly prefix: string,
    private readonly sink: AgentSink,
  ) {}

  update(update: Json): void {
    const type = update['sessionUpdate'];
    if (type === 'agent_message_chunk' || type === 'agent_thought_chunk') {
      const content = obj(update['content']);
      if (content?.['type'] !== 'text') return;
      const kind = type === 'agent_message_chunk' ? 'text' : 'thinking';
      if (this.block?.kind !== kind) {
        this.flush();
        this.block = { id: `${this.prefix}:block:${++this.sequence}`, kind, text: '' };
      }
      const text = str(content['text']);
      this.block.text += text;
      this.sink.delta(this.block.id, kind, text);
    } else if (type === 'tool_call' || type === 'tool_call_update') {
      this.flush();
      const callId = str(update['toolCallId']);
      if (!callId) return;
      const id = `${this.prefix}:tool:${callId}`;
      if (!this.tools.has(id)) {
        this.tools.add(id);
        this.sink.event({
          t: 'tool',
          id,
          name: str(update['name']) || str(update['title']) || str(update['kind']) || 'tool',
          input: update['rawInput'] ?? {},
        });
      }
      if (
        (update['status'] === 'completed' || update['status'] === 'failed') &&
        !this.results.has(id)
      ) {
        this.results.add(id);
        const content = jsonList(update['content'])
          .map((part) => {
            const block = obj(part['content']);
            if (part['type'] === 'content' && block?.['type'] === 'text') return str(block['text']);
            if (part['type'] === 'diff') return `${str(part['path'])}\n${str(part['newText'])}`;
            return '';
          })
          .filter(Boolean)
          .join('\n');
        const output =
          content ||
          (typeof update['rawOutput'] === 'string'
            ? update['rawOutput']
            : JSON.stringify(update['rawOutput'] ?? ''));
        this.sink.event({ t: 'tool-result', id, output, isError: update['status'] === 'failed' });
      }
    }
  }

  flush(): void {
    if (!this.block) return;
    const { id, kind, text } = this.block;
    this.block = null;
    this.sink.event({ t: kind, id, text });
  }
}
