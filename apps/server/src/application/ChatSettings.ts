import type { AgentFeatures, ChatConfig, ModelChoice } from '@deck/shared';
import type { AgentConfig } from '../domain/agent.js';

/** What a chat knows about the models of its provider. */
export interface ModelSource {
  choices(): ModelChoice[];
  /** Looks the list up again when it is old (answered later through the provider's change event). */
  refresh(): void;
  defaultModel(): string | null;
  /** The model that last answered for this provider (or its configured one), for a chat that has not run. */
  lastKnown(): string | null;
  /** The person chose a permission mode: new chats of this provider start with it. */
  keepMode(mode: string): void;
  /** A model really answered: keep it as the last known. */
  remember(model: string): void;
}

export interface RunState {
  config: AgentConfig;
  chatId: string | null;
  fork: boolean;
  resumeAt: string | null;
  dropsTurn: string | null;
}

/** What decides how the next agent run starts: the person's settings and which saved chat to continue. */
export class ChatSettings {
  config: AgentConfig;
  chatId: string | null;
  private fork: boolean;
  /** The model the agent said is answering this chat. */
  private effective: string | null = null;
  /** Where the next run resumes the saved chat (after an edited message), and the message it replaces. */
  private back: { at: string; drops: string } | null = null;

  constructor(
    initial: { config: AgentConfig; chatId: string | null; fork: boolean },
    private readonly info: {
      features?: AgentFeatures;
      agent: ChatConfig['agent'];
      models: ModelSource;
    },
  ) {
    ({ config: this.config, chatId: this.chatId, fork: this.fork } = initial);
  }

  view(): ChatConfig {
    const { info } = this;
    return {
      agent: info.agent,
      ...(info.features ? { features: info.features } : {}),
      ...this.config,
      autoCompact: this.config.autoCompact ?? null,
      effectiveModel: this.effectiveModel(),
      defaultModel: info.models.defaultModel(),
      modelChoices: info.models.choices(),
      chatId: this.chatId,
    };
  }

  /** The model really answering: as reported, else what it will be (the default, or the last known). */
  private effectiveModel(): string | null {
    if (this.effective) return this.effective;
    if (this.config.model) return null;
    const { models } = this.info;
    return models.defaultModel() ?? models.lastKnown();
  }

  /** The agent named its model; true when that is news. */
  reported(model: string): boolean {
    this.info.models.remember(model);
    if (model === this.effective) return false;
    this.effective = model;
    return true;
  }

  /** The model changed: what the agent said before is out of date. */
  forgetModel(): void {
    this.effective = null;
  }

  defaultModel(): string | null {
    return this.info.models.defaultModel();
  }

  keepMode(mode: string): void {
    this.info.models.keepMode(mode);
  }

  /** What the agent port is given to start a run. */
  run(): RunState {
    const { back } = this;
    return {
      config: this.config,
      chatId: this.chatId,
      fork: this.fork,
      resumeAt: back?.at ?? null,
      dropsTurn: back?.drops ?? null,
    };
  }

  /** The agent saved the conversation under this id. */
  saved(id: string): void {
    this.chatId = id;
    this.fork = false;
  }

  /** The next run continues the saved chat at `back`, or (null) a new conversation begins. */
  goBack(back: { at: string; drops: string } | null): void {
    this.back = back;
    if (!back) this.startOver();
  }

  /** The run has started with what `run()` gave it. */
  started(): void {
    this.back = null;
  }

  startOver(): void {
    this.chatId = null;
    this.fork = false;
    this.back = null;
  }
}
