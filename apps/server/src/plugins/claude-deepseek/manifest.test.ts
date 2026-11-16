import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ProviderPluginManifestSchema } from '@deck/shared';

describe('DeepSeek plugin', () => {
  it('packages its endpoint, model, context size and required authentication together', () => {
    const manifest = ProviderPluginManifestSchema.parse(
      JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8')),
    );
    expect(manifest.template.env).toMatchObject({
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_MODEL: 'deepseek-chat',
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: '128000',
    });
    expect(manifest.template.apiKey?.required).toBe(true);
    expect(manifest.authMethods.map((method) => method.flow)).toEqual(['key']);
  });
});
