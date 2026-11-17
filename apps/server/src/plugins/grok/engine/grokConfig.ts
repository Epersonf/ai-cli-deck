import type { AgentConfig, AgentSink } from '../../../domain/agent.js';
import type { GrokRpc } from './grokRpc.js';
import { jsonList } from '../../antigravity/engine/antigravityMap.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

/** Session-scoped model and effort, using only what Grok advertises for this session (never hardcoded). */
export class GrokConfig {
  private options: Json[] = [];
  private models: Json[] = [];
  private current = '';
  private applied: AgentConfig | null = null;

  constructor(private readonly sink: AgentSink) {}

  read(response: Json): void {
    if (Array.isArray(response['configOptions']))
      this.options = jsonList(response['configOptions']);
    const models = obj(response['models']);
    if (models) {
      this.models = jsonList(models['availableModels']);
      this.current = str(models['currentModelId']) || this.current;
    }
    const model = this.options.find((item) => item['category'] === 'model');
    this.current = str(model?.['currentValue']) || this.current;
    if (this.current) this.sink.model(this.current);
  }

  /** The context window of the model answering now, as the model catalog states it. */
  contextWindow(): number | undefined {
    const meta = obj(this.models.find((item) => item['modelId'] === this.current)?.['_meta']);
    const size = meta?.['totalContextTokens'];
    return typeof size === 'number' && size > 0 ? size : undefined;
  }

  private async choose(
    rpc: GrokRpc,
    sessionId: string,
    category: 'model' | 'thought_level',
    value: string,
  ): Promise<boolean> {
    const option = this.options.find((item) => item['category'] === category);
    if (!option) return false;
    const offered = jsonList(option['options']).find((item) => item['value'] === value);
    if (!offered) return false;
    this.read(
      await rpc.request('session/set_config_option', { sessionId, configId: option['id'], value }),
    );
    return true;
  }

  async apply(rpc: GrokRpc, sessionId: string, desired: AgentConfig): Promise<void> {
    if (desired.model && desired.model !== this.applied?.model) {
      if (!(await this.choose(rpc, sessionId, 'model', desired.model))) {
        if (this.models.length && !this.models.some((item) => item['modelId'] === desired.model))
          throw new Error(`Grok Build does not offer the model ${desired.model} on this account`);
        await rpc.request('session/set_model', { sessionId, modelId: desired.model });
        this.current = desired.model;
        this.sink.model(desired.model);
      }
    }
    // An effort this model does not offer is skipped: the model keeps its own default.
    if (desired.effort && desired.effort !== this.applied?.effort)
      await this.choose(rpc, sessionId, 'thought_level', desired.effort);
    this.applied = desired;
  }
}
