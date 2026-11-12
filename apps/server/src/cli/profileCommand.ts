import { homedir } from 'node:os';
import { join } from 'node:path';
import { fieldProblem, profileIdFor, type ProfileTemplate } from '@deck/shared';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';
import { FileTemplateStore } from '../infrastructure/store/FileTemplateStore.js';
import { JsonProfileStore } from '../infrastructure/store/JsonProfileStore.js';

export interface ProfileRequest {
  label: string;
  /** Id of the template the profile is made from. */
  base: string;
  values: Record<string, string>;
}

const usage = (templates: readonly ProfileTemplate[]): string =>
  `usage: clideck profile add "<name>" <${templates.map((t) => t.id).join('|')}> [--<field> <value>]...
  e.g. --url <api-base-url> (same as --baseUrl) and --model <name>; a template lists its fields.`;

/** `--url` is the short form of the endpoint template's `baseUrl` field. */
const ALIASES: Readonly<Record<string, string>> = { url: 'baseUrl' };

function readValues(options: readonly string[]): Record<string, string> | string {
  const values: Record<string, string> = {};
  for (let i = 0; i < options.length; i += 2) {
    const flag = options[i] ?? '';
    const value = options[i + 1];
    if (!flag.startsWith('--') || value === undefined)
      return `expected "--<field> <value>", got "${flag}"`;
    const key = flag.slice(2);
    values[ALIASES[key] ?? key] = value;
  }
  return values;
}

/** Parses `"<name>" <template> [--<field> <value>]...`; returns an error message when it is wrong. */
export function parseProfileArgs(
  args: readonly string[],
  templates: readonly ProfileTemplate[] = BUILTIN_TEMPLATES,
): ProfileRequest | string {
  const [label, base, ...options] = args;
  const template = templates.find((t) => t.id === base);
  if (!label?.trim() || !template) return usage(templates);
  const values = readValues(options);
  if (typeof values === 'string') return `${values}\n${usage(templates)}`;
  const problem = fieldProblem(template, values);
  return problem
    ? `${problem}\n${usage(templates)}`
    : { label: label.trim(), base: template.id, values };
}

/** The built-in templates plus the ones imported in the deck's settings. */
export async function knownTemplates(env = process.env): Promise<ProfileTemplate[]> {
  const imported = await new FileTemplateStore(join(configDir(env), 'templates')).load();
  const builtin = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
  return [...BUILTIN_TEMPLATES, ...imported.filter((t) => !builtin.has(t.id))];
}

const configDir = (env: NodeJS.ProcessEnv): string =>
  env['DECK_CONFIG_DIR'] ?? join(homedir(), '.config', 'ai-cli-deck');

/** Saves a clean profile; a running deck picks it up on next start (the UI adds it live). */
export async function addProfile(request: ProfileRequest, env = process.env): Promise<string> {
  const store = new JsonProfileStore(join(configDir(env), 'profiles.json'));
  const all = await store.load();
  const id = profileIdFor(
    request.label,
    all.map((p) => p.id),
  );
  await store.save([...all, { ...request, id }]);
  return `Profile "${request.label}" (${id}) saved: a clean agent profile. Restart the deck to use it, then add its API key there.`;
}
