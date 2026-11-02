import type { ProviderSecrets } from '../../domain/provider.js';
import type { AppConfig } from './schema.js';

/** API keys for the built-in providers; `deepseekApiKey` is the legacy spelling. */
export function secretsFromConfig(
  config: AppConfig,
  env: Readonly<Record<string, string | undefined>> = {},
): ProviderSecrets {
  return {
    anthropicApiKey: config.apiKeys.anthropic ?? null,
    openaiApiKey: config.apiKeys.openai ?? null,
    deepseekApiKey:
      config.apiKeys.deepseek ?? config.deepseekApiKey ?? env['DEEPSEEK_API_KEY'] ?? null,
  };
}
