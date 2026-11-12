import type { ProfileTemplate } from '@deck/shared';

/** One line of explanation for each part, written above it in an exported template. */
const NOTES: ReadonlyArray<readonly [keyof ProfileTemplate, string]> = [
  ['schema', 'Always 1 (the version of this format).'],
  ['id', 'Unique name: lowercase letters, digits and dashes. Built-in ids cannot be reused.'],
  ['label', 'Name shown in the lists.'],
  ['description', 'One line about it (optional).'],
  [
    'agent',
    'The engine that runs the chat: "claude" (any Anthropic-compatible endpoint) or "codex".',
  ],
  ['model', 'The model the chat starts with, or null for the default.'],
  ['env', 'Environment variables for the agent; values may use the placeholders below.'],
  [
    'home',
    'The variable the agent reads its config/login folder from. The deck points it at a folder of this profile alone.',
  ],
  ['fields', 'Values asked when the profile is created ("type" is "text" or "url").'],
  [
    'apiKey',
    'An API key typed in the profile dialog, kept in the profile folder and passed in "env". "required": false allows the machine login.',
  ],
  ['install', '"claude" or "codex" if `clideck setup` can download the agent that way, else null.'],
];

const PLACEHOLDERS = `  // Placeholders usable in env values and apiKey.label:
  //   {home} {port} {cwd} {field.<key>} {field.<key>.host} {mcpUrl}`;

const indent = (json: string): string => json.split('\n').join('\n  ');

/** A template as JSON with a comment above each part, ready to edit and import again. */
export function exportTemplate(template: ProfileTemplate): string {
  const parts = NOTES.map(
    ([key, note]) =>
      `  // ${note}\n  ${JSON.stringify(key)}: ${indent(JSON.stringify(template[key], null, 2))}`,
  );
  const kind =
    'ai-cli-deck profile template. JSON with comments. Importing one sets environment variables for the agent: trust it first.';
  return `{\n  // ${kind}\n\n${parts.join(',\n\n')}\n\n${PLACEHOLDERS}\n}\n`;
}
