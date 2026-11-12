import type { Block } from './blocks';
import { summarize } from './toolInfo';

/** The conversation as Markdown text, for copying out of the chat (tools are one line each, thinking is left out). */
export function transcript(blocks: readonly Block[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case 'user':
        parts.push(`**You:** ${block.text}`);
        break;
      case 'text':
        parts.push(block.text);
        break;
      case 'tool': {
        const { title } = summarize(block.name, block.input);
        parts.push(`> ${block.name}${title === '' ? '' : `: ${title}`}`);
        break;
      }
      case 'notice':
        parts.push(`_${block.text}_`);
        break;
      default:
        break;
    }
  }
  return parts.join('\n\n');
}
