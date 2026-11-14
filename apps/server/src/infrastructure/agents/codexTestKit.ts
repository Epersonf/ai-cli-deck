import { readFileSync } from 'node:fs';
import type { ChatEvent } from '@deck/shared';
import type { AgentSink, UsageReading } from '../../domain/agent.js';
import { mapCodexLine, newCodexState } from './codexMap.js';

export const fixture = (name: string): string[] =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
    .split(String.fromCharCode(10))
    .filter((line) => line.trim() !== '');

export function run(lines: string[], itemPrefix = '') {
  const events: ChatEvent[] = [];
  const chats: string[] = [];
  const usage: UsageReading[] = [];
  const sink: AgentSink = {
    event: (e) => events.push(e),
    delta: () => undefined,
    model: () => undefined,
    chatId: (id) => chats.push(id),
    usage: (u) => usage.push(u),
    ended: () => undefined,
  };
  const state = newCodexState(itemPrefix);
  for (const line of lines) mapCodexLine(JSON.parse(line) as Record<string, unknown>, state, sink);
  return { events, chats, state, usage };
}
