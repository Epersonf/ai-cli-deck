import { ChatCompaction } from './ChatCompaction.js';
import { ChatRetry } from './ChatRetry.js';
import type { ChatBook } from './ChatBook.js';
import type { ChatSettings } from './ChatSettings.js';
import type { TurnRunner } from './TurnRunner.js';
import type { RuntimeDeps } from './RuntimeDeps.js';
import type { AgentSink } from '../domain/agent.js';

interface Controls {
  sink(): AgentSink;
  ready(): Promise<void>;
  isBusy(): boolean;
  setBusy(busy: boolean, force?: boolean): void;
  changed(): void;
  submit(): void;
}

export function runtimeControls(
  deps: RuntimeDeps,
  book: ChatBook,
  settings: ChatSettings,
  runner: TurnRunner,
  c: Controls,
) {
  const compaction = new ChatCompaction({
    agent: deps.agent,
    kind: deps.info.agent,
    ...(deps.info.features ? { strategy: deps.info.features.compaction } : {}),
    settings,
    book,
    ready: c.ready,
    spec: () => deps.spec(settings.run()),
    sink: c.sink,
    isBusy: c.isBusy,
    setBusy: c.setBusy,
    closeRun: () => runner.close(),
    dispatch: () => runner.dispatch(),
    submit: c.submit,
    configChanged: c.changed,
  });
  const retry = new ChatRetry({
    book,
    settings,
    runner,
    uuid: deps.uuid,
    usage: () => deps.meter.current(),
    changed: c.changed,
    hold: () => c.setBusy(true, true),
    release: () => {
      c.setBusy(false);
      runner.dispatch();
    },
    persistence: deps.retry ?? { initial: null, save: () => Promise.resolve() },
  });
  return { compaction, retry };
}
