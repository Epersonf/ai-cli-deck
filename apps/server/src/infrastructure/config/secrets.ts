import type { ProviderSecrets } from '../../domain/provider.js';
import type { AppConfig } from './schema.js';

/** The DeepSeek key comes from the environment or config.json; no other CLI needs a key from us. */
export function secretsFromConfig(
  config: AppConfig,
  env: Readonly<Record<string, string | undefined>> = {},
): ProviderSecrets {
  return { deepseekApiKey: config.deepseekApiKey ?? env['DEEPSEEK_API_KEY'] ?? null };
}
