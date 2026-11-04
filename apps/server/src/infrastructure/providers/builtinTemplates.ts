import { ProfileTemplateSchema, type ProfileTemplate } from '@deck/shared';
import type { z } from 'zod';

/** How Claude Code is handed the deck's MCP server and briefing. */
const CLAUDE_MCP = ['--mcp-config', '{mcpConfig}', '--append-system-prompt', '{guide}'];
/** The same for Codex. */
const CODEX_MCP = [
  '-c',
  'mcp_servers.deck.url={mcpUrlJson}',
  '-c',
  'developer_instructions={guideJson}',
];

const make = (template: Omit<z.input<typeof ProfileTemplateSchema>, 'schema'>): ProfileTemplate =>
  ProfileTemplateSchema.parse({ schema: 1, ...template });

/** The templates that ship with the deck. They are ordinary templates: nothing here is special-cased. */
export const BUILTIN_TEMPLATES: readonly ProfileTemplate[] = [
  make({
    id: 'claude',
    label: 'Claude Code',
    description: 'Anthropic’s Claude Code, signed in on its first start.',
    command: 'claude',
    home: { env: 'CLAUDE_CONFIG_DIR' },
    mcpArgs: CLAUDE_MCP,
    install: 'claude',
  }),
  make({
    id: 'claude-endpoint',
    label: 'Claude Code (custom endpoint)',
    description: 'Claude Code against any Anthropic-compatible API, such as a company gateway.',
    command: 'claude',
    env: { ANTHROPIC_BASE_URL: '{field.baseUrl}' },
    home: { env: 'CLAUDE_CONFIG_DIR' },
    fields: [
      {
        key: 'baseUrl',
        label: 'API base URL',
        type: 'url',
        required: true,
        hint: 'Where Claude Code sends its requests. The key is asked in the terminal.',
        placeholder: 'https://llm.example.com/anthropic',
      },
    ],
    apiKey: {
      env: 'ANTHROPIC_AUTH_TOKEN',
      label: 'API key for {field.baseUrl.host}',
      remember: true,
    },
    mcpArgs: CLAUDE_MCP,
    install: 'claude',
  }),
  make({
    id: 'claude-deepseek',
    label: 'Claude Code (DeepSeek)',
    description: 'Claude Code through DeepSeek’s Anthropic-compatible API. Only the key is yours.',
    command: 'claude',
    env: {
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_MODEL: 'deepseek-chat',
      ANTHROPIC_SMALL_FAST_MODEL: 'deepseek-chat',
    },
    home: { env: 'CLAUDE_CONFIG_DIR' },
    apiKey: { env: 'ANTHROPIC_AUTH_TOKEN', label: 'DeepSeek API key', remember: true },
    mcpArgs: CLAUDE_MCP,
    install: 'claude',
  }),
  make({
    id: 'codex',
    label: 'Codex',
    description: 'OpenAI’s Codex CLI, signed in on its first start.',
    command: 'codex',
    home: { env: 'CODEX_HOME' },
    mcpArgs: CODEX_MCP,
    install: 'codex',
  }),
  make({
    id: 'custom',
    label: 'Custom command',
    description: 'Any program, started in its own terminal. Empty means the default shell.',
    command: '{field.command}',
    fields: [
      {
        key: 'command',
        label: 'Program to run (empty = shell)',
        placeholder: 'aider',
      },
    ],
  }),
];

export const BUILTIN_IDS: readonly string[] = BUILTIN_TEMPLATES.map((t) => t.id);
