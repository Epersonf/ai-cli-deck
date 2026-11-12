import { ProfileTemplateSchema, type ProfileTemplate } from '@deck/shared';
import type { z } from 'zod';

const make = (template: Omit<z.input<typeof ProfileTemplateSchema>, 'schema'>): ProfileTemplate =>
  ProfileTemplateSchema.parse({ schema: 1, ...template });

/** The templates that ship with the deck. They are ordinary templates: nothing here is special-cased. */
export const BUILTIN_TEMPLATES: readonly ProfileTemplate[] = [
  make({
    id: 'claude',
    label: 'Claude Code',
    description: 'Anthropic’s Claude Code. Paste a token or key, or use this machine’s login.',
    agent: 'claude',
    home: { env: 'CLAUDE_CONFIG_DIR' },
    apiKey: {
      env: 'ANTHROPIC_API_KEY',
      label: 'Claude Code token or API key (empty = this machine’s Claude login)',
      required: false,
    },
    install: 'claude',
  }),
  make({
    id: 'claude-endpoint',
    label: 'Claude Code (custom provider)',
    description: 'Claude Code against any Anthropic-compatible API, such as a company gateway.',
    agent: 'claude',
    env: { ANTHROPIC_BASE_URL: '{field.baseUrl}', ANTHROPIC_MODEL: '{field.model}' },
    home: { env: 'CLAUDE_CONFIG_DIR' },
    fields: [
      {
        key: 'baseUrl',
        label: 'API base URL',
        type: 'url',
        required: true,
        hint: 'Where Claude Code sends its requests.',
        placeholder: 'https://llm.example.com/anthropic',
      },
      {
        key: 'model',
        label: 'Model (optional)',
        hint: 'Left empty, the gateway’s default is used. It can be changed in the chat.',
        placeholder: 'my-model',
      },
    ],
    apiKey: {
      env: 'ANTHROPIC_AUTH_TOKEN',
      label: 'API key for {field.baseUrl.host}',
      required: true,
    },
    install: 'claude',
  }),
  make({
    id: 'claude-deepseek',
    label: 'Claude Code (DeepSeek)',
    description: 'Claude Code through DeepSeek’s Anthropic-compatible API. Only the key is yours.',
    agent: 'claude',
    env: {
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_MODEL: 'deepseek-chat',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-chat',
      // Claude Code does not know this model: without the real window it warns and assumes 200k.
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: '128000',
    },
    home: { env: 'CLAUDE_CONFIG_DIR' },
    apiKey: { env: 'ANTHROPIC_AUTH_TOKEN', label: 'DeepSeek API key', required: true },
    install: 'claude',
  }),
  make({
    id: 'codex',
    label: 'Codex',
    description: 'OpenAI’s Codex CLI. Paste an API key, or use this machine’s `codex login`.',
    agent: 'codex',
    home: { env: 'CODEX_HOME' },
    apiKey: {
      env: 'OPENAI_API_KEY',
      label: 'OpenAI API key (empty = this machine’s Codex login)',
      required: false,
    },
    install: 'codex',
  }),
];

export const BUILTIN_IDS: readonly string[] = BUILTIN_TEMPLATES.map((t) => t.id);
