import type { ChatConfig } from '@deck/shared';
import type { AgentSink } from '../domain/agent.js';
import type { RuntimeDeps } from './RuntimeDeps.js';
import type { ChatBook } from './ChatBook.js';
import type { ChatSettings } from './ChatSettings.js';
import { TurnRunner } from './TurnRunner.js';
import { TurnNotice } from './TurnNotice.js';
import { ChatTuning } from './ChatTuning.js';
import { chatSink } from './chatSink.js';
import { runtimeControls } from './runtimeControls.js';

interface Host {
  config(): ChatConfig;
  isBusy(): boolean;
  setBusy(busy: boolean, force?: boolean): void;
  submitCompact(): void;
  pushUsage(): void;
}

/** Connects provider callbacks to one runtime, including native controls and rate-limit continuation. */
export function runtimeWiring(deps: RuntimeDeps, book: ChatBook, settings: ChatSettings, h: Host) {
  const notice = new TurnNotice(deps.id, deps.bus, book);
  const runner = new TurnRunner({
    agent: deps.agent,
    book,
    settings,
    notice,
    spec: deps.spec,
    sink: () => sink,
    isBusy: h.isBusy,
    setBusy: h.setBusy,
  });
  const controls = runtimeControls(deps, book, settings, runner, {
    sink: () => sink,
    ready: () => book.ready(),
    isBusy: h.isBusy,
    setBusy: h.setBusy,
    changed: () => tuning.push(),
    submit: h.submitCompact,
  });
  const tuning = new ChatTuning({
    id: deps.id,
    bus: deps.bus,
    settings,
    remember: deps.remember,
    run: () => runner.run,
    view: h.config,
  });
  const sink: AgentSink = chatSink({
    book,
    settings,
    meter: deps.meter,
    remember: deps.remember,
    reportModel: (model) => tuning.reported(model),
    pushUsage: h.pushUsage,
    configChanged: () => tuning.push(),
    setBusy: h.setBusy,
    next: () => runner.dispatch(),
    finished: (error) => notice.ended(error),
    ended: () => {
      runner.run = null;
    },
    blocked: (event) => {
      const held = controls.retry.ended(event);
      if (held && controls.retry.view()?.status === 'offered') notice.ended(event.error);
      return held;
    },
  });
  return { runner, tuning, ...controls };
}
