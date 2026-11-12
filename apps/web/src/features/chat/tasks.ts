import type { ChatEvent } from '@deck/shared';

export type TaskEvent = Extract<ChatEvent, { t: 'task' }>;
export interface ChatTask {
  id: string;
  title: string;
  state: TaskEvent['state'];
}

/** The task list after one more `task` event: a known id is updated in place, a new one is added. */
export function upsertTask(tasks: readonly ChatTask[], event: TaskEvent): ChatTask[] {
  const next: ChatTask = { id: event.id, title: event.title, state: event.state };
  const at = tasks.findIndex((task) => task.id === event.id);
  if (at < 0) return [...tasks, next];
  return tasks.map((task, i) => (i === at ? next : task));
}

/** The tasks a conversation's events end with. */
export function tasksFrom(events: readonly ChatEvent[]): ChatTask[] {
  let tasks: ChatTask[] = [];
  for (const event of events) if (event.t === 'task') tasks = upsertTask(tasks, event);
  return tasks;
}

export const runningCount = (tasks: readonly ChatTask[]): number =>
  tasks.filter((task) => task.state === 'running').length;
