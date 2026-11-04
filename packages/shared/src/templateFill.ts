import { isHttpUrl } from './profile.js';
import type { ProfileTemplate } from './template.js';

/** Placeholders every template may use; `{field.<key>}` (and `{field.<key>.host}` for URLs) come from its fields. */
export const TEMPLATE_VARS = [
  'home',
  'port',
  'cwd',
  'mcpUrl',
  'mcpUrlJson',
  'mcpConfig',
  'guide',
  'guideJson',
] as const;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_.]*)\}/g;

/** Replaces `{name}` with its value; unknown names are left as written. */
export function fillText(text: string, vars: Readonly<Record<string, string>>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => vars[name] ?? whole);
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** `field.<key>` (and `.host` for urls) for each field of the template. */
export function fieldVars(
  template: ProfileTemplate,
  values: Readonly<Record<string, string>>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const field of template.fields) {
    const value = values[field.key] ?? '';
    vars[`field.${field.key}`] = value;
    if (field.type === 'url') vars[`field.${field.key}.host`] = hostOf(value);
  }
  return vars;
}

const strings = (template: ProfileTemplate): string[] => [
  template.command,
  ...template.args,
  ...Object.values(template.env),
  ...template.mcpArgs,
  template.apiKey?.label ?? '',
];

/** What is wrong with a template beyond its shape (unknown placeholders, repeated field keys). */
export function templateProblems(template: ProfileTemplate): string[] {
  const known = new Set<string>(TEMPLATE_VARS);
  const keys = template.fields.map((f) => f.key);
  const problems: string[] = [];
  if (new Set(keys).size !== keys.length) problems.push('field keys must be unique');
  for (const field of template.fields) {
    known.add(`field.${field.key}`);
    if (field.type === 'url') known.add(`field.${field.key}.host`);
  }
  const unknown = new Set<string>();
  for (const text of strings(template)) {
    for (const match of text.matchAll(PLACEHOLDER)) {
      const name = match[1] ?? '';
      if (!known.has(name)) unknown.add(name);
    }
  }
  for (const name of unknown) problems.push(`unknown placeholder {${name}}`);
  return problems;
}

/** The first problem with the values typed for a template's fields, or null when they are fine. */
export function fieldProblem(
  template: ProfileTemplate,
  values: Readonly<Record<string, string>>,
): string | null {
  const known = new Set(template.fields.map((f) => f.key));
  for (const key of Object.keys(values)) if (!known.has(key)) return `Unknown field "${key}"`;
  for (const field of template.fields) {
    const value = (values[field.key] ?? '').trim();
    if (value === '' && field.required) return `${field.label} is required`;
    if (value !== '' && field.type === 'url' && !isHttpUrl(value))
      return `${field.label} must be an http:// or https:// address`;
  }
  return null;
}
