import type { AgentConfig, AgentSink } from '../../../domain/agent.js';
import type { AntigravityRpc } from './antigravityRpc.js';
import { jsonList } from './antigravityMap.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

/** Session-scoped model and permission settings, using only options advertised by agy. */
export class AntigravityConfig {
  private options: Json[] = [];
  private modes: Json[] = [];
  private applied: AgentConfig | null = null;

  constructor(private readonly sink: AgentSink) {}

  read(response: Json): void {
    if (Array.isArray(response['configOptions']))
      this.options = jsonList(response['configOptions']);
    if (response['modes']) this.modes = jsonList(obj(response['modes'])?.['availableModes']);
    const model = this.options.find((item) => item['category'] === 'model');
    const current =
      str(model?.['currentValue']) || str(obj(response['models'])?.['currentModelId']);
    if (current) this.sink.model(current);
  }

  async apply(rpc: AntigravityRpc, sessionId: string, desired: AgentConfig): Promise<void> {
    const mode = desired.mode === 'acceptEdits' ? 'accept-edits' : desired.mode;
    if (this.applied?.mode !== desired.mode) {
      if (!['default', 'accept-edits', 'plan'].includes(mode))
        throw new Error(`Antigravity does not support permission mode ${desired.mode}`);
      if (this.modes.length && !this.modes.some((item) => item['id'] === mode))
        throw new Error(`Antigravity does not offer ${mode} mode`);
      await rpc.request('session/set_mode', { sessionId, modeId: mode });
    }
    for (const category of ['model', 'thought_level']) {
      const value = category === 'model' ? desired.model : desired.effort;
      const previous = category === 'model' ? this.applied?.model : this.applied?.effort;
      if (!value || value === previous) continue;
      const option = this.options.find((item) => item['category'] === category);
      if (!option) {
        if (category === 'model')
          await rpc.request('session/set_model', { sessionId, modelId: value });
        else throw new Error('This Antigravity model does not offer a thinking-level setting');
      } else {
        const values = jsonList(option['options']).flatMap((item) =>
          Array.isArray(item['options']) ? jsonList(item['options']) : [item],
        );
        const selected = values.find(
          (item) =>
            item['value'] === value ||
            (category === 'thought_level' &&
              str(item['name']).toLowerCase() === (value === 'xhigh' ? 'extra' : value)),
        );
        if (!selected) throw new Error(`Antigravity does not offer ${category} ${value}`);
        this.read(
          await rpc.request('session/set_config_option', {
            sessionId,
            configId: option['id'],
            value: selected['value'],
          }),
        );
      }
      if (category === 'model') this.sink.model(value);
    }
    this.applied = desired;
  }
}
