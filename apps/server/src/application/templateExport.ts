import type { ProfileTemplate } from '@deck/shared';

/** One line of explanation for each part, written above it in an exported template. */
const NOTES: ReadonlyArray<readonly [keyof ProfileTemplate, string]> = [
  ['schema', 'Always 1 (the version of this format).'],
  ['id', 'Unique name: lowercase letters, digits and dashes. Built-in ids cannot be reused.'],
  ['label', 'Name shown in the lists.'],
  ['description', 'One line about it (optional).'],
  [
    'command',
    'The program to start; empty means the default shell. {field.<key>} runs what the user types.',
  ],
  ['args', 'Fixed arguments, placed before any the user adds. One entry per argument.'],
  ['env', 'Environment variables for the program; values may use the placeholders below.'],
  [
    'home',
    'The variable the CLI reads its config/login folder from. The deck points it at a folder of this profile alone.',
  ],
  ['fields', 'Values asked when the profile is created ("type" is "text" or "url").'],
  [
    'apiKey',
    'Ask for an API key (typed hidden) when starting without one. "remember" keeps it in <home>/settings.json.',
  ],
  ['mcpArgs', "Arguments that hand the CLI the deck's MCP server and briefing."],
  ['install', '"claude" or "codex" if `clideck setup` can download your CLI that way, else null.'],
  [
    'chat',
    'How the CLI continues its chats (null: only new ones). "format" ("claude", "codex" or null) lets the deck read them; "resume" and "fork" use {chatId}, "last" continues the latest one here, "prompt" starts with a first message ({prompt}).',
  ],
];

const PLACEHOLDERS = `  // Placeholders usable in command, args, env values, apiKey.label and mcpArgs:
  //   {home} {port} {cwd} {field.<key>} {field.<key>.host} {mcpUrl} {mcpUrlJson}
  //   {mcpConfig} {guide} {guideJson}`;

const indent = (json: string): string => json.split('\n').join('\n  ');

/** A template as JSON with a comment above each part, ready to edit and import again. */
export function exportTemplate(template: ProfileTemplate): string {
  const parts = NOTES.map(
    ([key, note]) =>
      `  // ${note}\n  ${JSON.stringify(key)}: ${indent(JSON.stringify(template[key], null, 2))}`,
  );
  const kind =
    'ai-cli-deck profile template. JSON with comments. Importing one lets the deck run its program: trust it first.';
  return `{\n  // ${kind}\n\n${parts.join(',\n\n')}\n\n${PLACEHOLDERS}\n}\n`;
}
