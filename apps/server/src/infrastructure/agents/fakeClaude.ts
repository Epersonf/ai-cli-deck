import type { ChatEvent } from '@deck/shared';
import type { AgentSink, UsageReading } from '../../domain/agent.js';
import type { QueryFn, QueryLike } from './claudeDriver.js';
import type { SdkMessage } from './claudeMap.js';

/** A fake SDK: yields what the test pushes, and records the options and what the user sent. */
export function fakeQuery() {
  const calls: Array<{ options: Record<string, unknown>; prompts: unknown[] }> = [];
  const out: SdkMessage[] = [];
  let wake: (() => void) | null = null;
  let done = false;
  const api = {
    interrupted: 0,
    stopped: [] as string[],
    rewound: [] as string[],
    canRewind: true,
    models: [] as Array<string | undefined>,
    supported: [] as Array<{ value: string; displayName?: string; description?: string }>,
    emit(message: SdkMessage) {
      out.push(message);
      wake?.();
    },
    end() {
      done = true;
      wake?.();
    },
  };
  const queryFn: QueryFn = ({ prompt, options }) => {
    const call = { options, prompts: [] as unknown[] };
    calls.push(call);
    void (async () => {
      for await (const message of prompt) call.prompts.push(message);
    })();
    const query: QueryLike = {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          while (out.length > 0) yield out.shift() as SdkMessage;
          if (done) return;
          await new Promise<void>((resolve) => (wake = resolve));
        }
      },
      interrupt: () => {
        api.interrupted += 1;
        return Promise.resolve();
      },
      setModel: (m) => {
        api.models.push(m);
        return Promise.resolve();
      },
      setPermissionMode: () => Promise.resolve(),
      supportedModels: () => Promise.resolve(api.supported),
      stopTask: (id) => {
        api.stopped.push(id);
        return Promise.resolve();
      },
      rewindFiles: (id) => {
        api.rewound.push(id);
        return Promise.resolve(
          api.canRewind ? { canRewind: true } : { canRewind: false, error: 'No checkpoint' },
        );
      },
      close: () => api.end(),
    };
    return query;
  };
  return { queryFn, calls, api };
}

export function sink() {
  const events: ChatEvent[] = [];
  const usage: UsageReading[] = [];
  let ended = 0;
  const s: AgentSink = {
    event: (e) => events.push(e),
    delta: () => undefined,
    model: () => undefined,
    chatId: () => undefined,
    usage: (u) => void usage.push(u),
    ended: () => void (ended += 1),
  };
  return { s, events, usage, ended: () => ended };
}
