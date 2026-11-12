import type { AgentConfig, AgentRun } from '../domain/agent.js';
import type { EventBus } from '../domain/events.js';
import type { ChatSettings } from './ChatSettings.js';

export interface TuningDeps {
  id: string;
  bus: EventBus;
  settings: ChatSettings;
  remember(patch: { config?: AgentConfig }): void;
  /** The agent run behind the chat, while there is one. */
  run(): AgentRun | null;
}

/** Changes to a chat's settings (model, mode, effort) and telling every device about them. */
export class ChatTuning {
  constructor(private readonly d: TuningDeps) {}

  /** The person changed something; a model of null goes back to the provider's default. */
  configure(patch: Partial<AgentConfig>): void {
    const { settings } = this.d;
    settings.config = { ...settings.config, ...patch };
    if (patch.model !== undefined) settings.forgetModel();
    if (patch.mode) settings.keepMode(patch.mode);
    const model = patch.model === null ? settings.defaultModel() : patch.model;
    this.d.run()?.setConfig(model === undefined ? patch : { ...patch, model });
    this.d.remember({ config: settings.config });
    this.push();
  }

  /** The agent named the model that is answering. */
  reported(model: string): void {
    if (this.d.settings.reported(model)) this.push();
  }

  /** The provider's default model or its list of models changed. */
  modelsChanged(defaultChanged: boolean): void {
    const { settings } = this.d;
    if (defaultChanged && settings.config.model === null) {
      settings.forgetModel();
      this.d.run()?.setConfig({ model: settings.defaultModel() });
    }
    this.push();
  }

  push(): void {
    const { id, bus, settings } = this.d;
    bus.publish({ kind: 'config', sessionId: id, config: settings.view() });
  }
}
