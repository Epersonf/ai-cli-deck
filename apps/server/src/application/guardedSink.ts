import type { AgentSink } from '../domain/agent.js';

/** Closed/replaced runs cannot end or update a newer turn (including one resumed after a limit). */
export function guardedSink(
  sink: AgentSink,
  active: () => boolean,
  cleanup: () => boolean = () => false,
): AgentSink {
  return {
    event: (event) => {
      if (
        active() ||
        (cleanup() &&
          (event.t === 'permission-done' || (event.t === 'task' && event.state !== 'running')))
      )
        sink.event(event);
    },
    delta: (id, kind, text) => {
      if (active()) sink.delta(id, kind, text);
    },
    chatId: (id) => {
      if (active()) sink.chatId(id);
    },
    model: (model) => {
      if (active()) sink.model(model);
    },
    usage: (usage) => {
      if (active()) sink.usage(usage);
    },
    ended: () => {
      if (active()) sink.ended();
    },
  };
}
