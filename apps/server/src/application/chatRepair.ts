import type { ChatEvent } from '@deck/shared';

/** Steps kept in memory (and on disk after a restart) per conversation. */
export const KEEP_EVENTS = 3000;
const LOAD_LIMIT = 4000;

/** The newest part of a long log. */
export function trimLog(events: ChatEvent[]): { events: ChatEvent[]; trimmed: boolean } {
  if (events.length <= LOAD_LIMIT) return { events, trimmed: false };
  return { events: events.slice(-KEEP_EVENTS), trimmed: true };
}

/**
 * What a restart left half done: permissions nobody can answer any more are denied, background tasks are marked
 * stopped and a turn that never finished is ended. Returns the steps to add to the log.
 */
export function closeDangling(events: readonly ChatEvent[]): ChatEvent[] {
  const open = new Set<string>();
  const tasks = new Map<string, { title: string; running: boolean }>();
  let turnOpen = false;
  for (const event of events) {
    if (event.t === 'permission') open.add(event.id);
    else if (event.t === 'permission-done') open.delete(event.id);
    else if (event.t === 'task')
      tasks.set(event.id, { title: event.title, running: event.state === 'running' });
    else if (event.t === 'turn-start') turnOpen = true;
    else if (event.t === 'turn-end') turnOpen = false;
  }
  const fixes: ChatEvent[] = [...open].map((id) => ({
    t: 'permission-done' as const,
    id,
    allowed: false,
  }));
  // Background jobs died with the server.
  for (const [id, task] of tasks) {
    if (task.running) fixes.push({ t: 'task', id, title: task.title, state: 'stopped' });
  }
  if (turnOpen)
    fixes.push({
      t: 'turn-end',
      error: 'The deck restarted while the agent was answering.',
      costUsd: null,
      durationMs: null,
    });
  return fixes;
}

/** Text of the last thing the assistant said, for notifications and agent tools. */
export function lastAnswer(events: readonly ChatEvent[]): string {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.t === 'text') return event.text;
  }
  return '';
}

/** The conversation as plain text lines (the end of it), for another agent to read. */
export function recentText(events: readonly ChatEvent[], lines: number): string {
  const out: string[] = [];
  for (const event of events) {
    if (event.t === 'user') out.push(`User: ${event.text}`);
    else if (event.t === 'text') out.push(`Assistant: ${event.text}`);
    else if (event.t === 'tool') out.push(`→ ${event.name}`);
    else if (event.t === 'turn-end' && event.error) out.push(`Error: ${event.error}`);
    else if (event.t === 'notice') out.push(`Note: ${event.text}`);
  }
  return out.join('\n').split('\n').slice(-lines).join('\n');
}
