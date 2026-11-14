import type { ChatConfig } from '@deck/shared';
import type { AgentConfig, AgentPort, AgentSpec } from '../domain/agent.js';
import type { EventBus } from '../domain/events.js';
import type { ChatLogPort } from '../domain/ports.js';
import type { ModelSource, RunState } from './ChatSettings.js';
import type { UsageMeter } from './UsageMeter.js';

export interface RuntimeDeps {
  id: string;
  agent: AgentPort;
  log: ChatLogPort;
  bus: EventBus;
  meter: UsageMeter;
  /** A fresh uuid: the id of a `user` step, which Claude keeps as the message's uuid. */
  uuid(): string;
  now(): Date;
  spec(state: RunState): AgentSpec;
  remember(patch: { chatId?: string; config?: AgentConfig }): void;
  busy(busy: boolean): void;
  info: { agent: ChatConfig['agent']; models: ModelSource; label: string };
  initial: { config: AgentConfig; chatId: string | null; fork: boolean };
}
