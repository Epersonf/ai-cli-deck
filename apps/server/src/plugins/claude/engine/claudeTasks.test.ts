import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { AgentSink, UsageReading } from '../../../domain/agent.js';
import { mapClaudeMessage, newMapState, type SdkMessage } from './claudeMap.js';
import { runningTasks, stopTasks } from './claudeTasks.js';

function collect() {
  const events: ChatEvent[] = [];
  const usage: UsageReading[] = [];
  const sink: AgentSink = {
    event: (e) => events.push(e),
    delta: () => undefined,
    model: () => undefined,
    chatId: () => undefined,
    usage: (u) => usage.push(u),
    ended: () => undefined,
  };
  const state = newMapState();
  const feed = (...messages: SdkMessage[]) =>
    messages.forEach((m) => mapClaudeMessage(m, state, sink));
  return { events, usage, state, sink, feed };
}

describe('background tasks from Claude', () => {
  it('shows a task started in the background and follows it to its end', () => {
    const { events, feed, state } = collect();
    feed(
      {
        type: 'system',
        subtype: 'task_started',
        task_id: 'b1',
        description: 'npm run dev',
        is_backgrounded: true,
      },
      {
        type: 'system',
        subtype: 'task_updated',
        task_id: 'b1',
        patch: { description: 'Dev server' },
      },
    );
    expect(runningTasks(state.tasks)).toBe(1);
    feed({ type: 'system', subtype: 'task_notification', task_id: 'b1', status: 'completed' });
    expect(events).toEqual([
      { t: 'task', id: 'b1', title: 'npm run dev', state: 'running' },
      { t: 'task', id: 'b1', title: 'Dev server', state: 'running' },
      { t: 'task', id: 'b1', title: 'Dev server', state: 'done' },
    ]);
    expect(runningTasks(state.tasks)).toBe(0);
  });

  it('keeps a foreground sub-agent out of the list until it is moved to the background', () => {
    const { events, feed } = collect();
    feed(
      {
        type: 'system',
        subtype: 'task_started',
        task_id: 'a1',
        description: 'Explore code',
        is_backgrounded: false,
      },
      { type: 'system', subtype: 'task_updated', task_id: 'a1', patch: { status: 'completed' } },
    );
    expect(events).toEqual([]);
    feed(
      {
        type: 'system',
        subtype: 'task_started',
        task_id: 'a2',
        description: 'Long search',
        is_backgrounded: false,
      },
      { type: 'system', subtype: 'task_updated', task_id: 'a2', patch: { is_backgrounded: true } },
      { type: 'system', subtype: 'task_updated', task_id: 'a2', patch: { status: 'killed' } },
    );
    expect(events.map((e) => (e.t === 'task' ? e.state : ''))).toEqual(['running', 'stopped']);
  });

  it('follows the set of live tasks: adds the ones it missed and ends the ones that left it', () => {
    const { events, feed } = collect();
    feed(
      {
        type: 'system',
        subtype: 'background_tasks_changed',
        tasks: [{ task_id: 'x', description: 'build' }],
      },
      {
        type: 'system',
        subtype: 'background_tasks_changed',
        tasks: [{ task_id: 'y', description: 'ambient', ambient: true }],
      },
    );
    expect(events).toEqual([
      { t: 'task', id: 'x', title: 'build', state: 'running' },
      { t: 'task', id: 'x', title: 'build', state: 'done' },
    ]);
  });

  it('marks what still runs as stopped when the run ends', () => {
    const { events, feed, state, sink } = collect();
    feed({
      type: 'system',
      subtype: 'task_started',
      task_id: 'b1',
      description: 'server',
      is_backgrounded: true,
    });
    stopTasks(state.tasks, sink);
    expect(events.at(-1)).toEqual({ t: 'task', id: 'b1', title: 'server', state: 'stopped' });
  });
});

describe('a task that starts again', () => {
  it('does not show up twice, and comes back to running after it ended', () => {
    const { events, feed } = collect();
    const started = {
      type: 'system',
      subtype: 'task_started',
      task_id: 'b1',
      description: 'dev',
      is_backgrounded: true,
    };
    feed(
      started,
      started,
      { type: 'system', subtype: 'task_notification', task_id: 'b1', status: 'completed' },
      started,
    );
    expect(events.map((e) => (e.t === 'task' ? e.state : ''))).toEqual([
      'running',
      'done',
      'running',
    ]);
  });
});
