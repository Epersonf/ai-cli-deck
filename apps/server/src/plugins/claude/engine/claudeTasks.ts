import type { ChatEvent } from '@deck/shared';
import type { AgentSink } from '../../../domain/agent.js';

type TaskState = Extract<ChatEvent, { t: 'task' }>['state'];

/** The SDK fields of a task message. */
export interface TaskMessage {
  type?: string;
  subtype?: string;
  task_id?: string;
  description?: string;
  is_backgrounded?: boolean;
  ambient?: boolean;
  skip_transcript?: boolean;
  status?: string;
  patch?: { status?: string; description?: string; is_backgrounded?: boolean };
  tasks?: { task_id: string; description?: string; ambient?: boolean }[];
}

/** Every task of the run; `shown` once it is a background job the person should see (not a foreground sub-agent). */
export type Tasks = Map<string, { title: string; state: TaskState; shown: boolean }>;

const ENDED: Record<string, TaskState> = {
  completed: 'done',
  failed: 'failed',
  killed: 'stopped',
  stopped: 'stopped',
};
const MAX_TITLE = 200;

function show(
  tasks: Tasks,
  sink: AgentSink,
  id: string,
  patch: { title?: string; state?: TaskState },
): void {
  const old = tasks.get(id) ?? {
    title: 'Background task',
    state: 'running' as const,
    shown: false,
  };
  const next = { ...old, ...patch, shown: true };
  tasks.set(id, next);
  if (old.shown && old.title === next.title && old.state === next.state) return;
  sink.event({ t: 'task', id, title: next.title.slice(0, MAX_TITLE), state: next.state });
}

/** Background jobs of the agent (dev servers, builds...) as `task` steps, from the SDK's task messages. */
export function mapTask(msg: TaskMessage, tasks: Tasks, sink: AgentSink): void {
  const id = msg.task_id ?? '';
  const title = msg.description?.trim() || undefined;
  if (msg.subtype === 'task_started' && id) {
    if (msg.ambient || msg.skip_transcript) return;
    // The same task can start again (a resumed one): what is already shown stays shown.
    if (tasks.get(id)?.shown)
      return show(tasks, sink, id, { state: 'running', ...(title && { title }) });
    tasks.set(id, { title: title ?? 'Background task', state: 'running', shown: false });
    if (msg.is_backgrounded) show(tasks, sink, id, {});
  } else if (msg.subtype === 'task_updated' && id) {
    const ended = ENDED[msg.patch?.status ?? ''];
    const known = tasks.get(id);
    if (!known) return;
    const name = msg.patch?.description?.trim() || undefined;
    if (msg.patch?.is_backgrounded || known.shown) {
      show(tasks, sink, id, {
        ...(name ? { title: name } : {}),
        ...(ended ? { state: ended } : {}),
      });
    } else if (ended) tasks.delete(id);
  } else if (msg.subtype === 'task_notification' && id) {
    const ended = ENDED[msg.status ?? ''];
    if (ended && tasks.get(id)?.shown) show(tasks, sink, id, { state: ended });
  } else if (msg.subtype === 'background_tasks_changed') {
    const live = new Set<string>();
    for (const task of msg.tasks ?? []) {
      if (task.ambient) continue;
      live.add(task.task_id);
      const name = task.description?.trim() || undefined;
      if (!tasks.get(task.task_id)?.shown)
        show(tasks, sink, task.task_id, name ? { title: name } : {});
    }
    for (const [taskId, task] of tasks) {
      if (task.shown && task.state === 'running' && !live.has(taskId))
        show(tasks, sink, taskId, { state: 'done' });
    }
  }
}

/** How many background jobs are still running (the run must stay open for them). */
export const runningTasks = (tasks: Tasks): number =>
  [...tasks.values()].filter((t) => t.shown && t.state === 'running').length;

/** The run is over: whatever was still running died with it. */
export function stopTasks(tasks: Tasks, sink: AgentSink): void {
  for (const [id, task] of tasks) {
    if (task.shown && task.state === 'running') show(tasks, sink, id, { state: 'stopped' });
  }
}
