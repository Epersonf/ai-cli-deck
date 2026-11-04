import type { TemplateField, TemplateInfo } from '@deck/shared';
import type { MessageKey } from '../../shared/i18n/en';

type Translate = (key: MessageKey) => string;

/** The built-in templates have translated names; imported ones show the name their file gives. */
const KNOWN: Readonly<Record<string, MessageKey>> = {
  claude: 'profile.base.claude',
  codex: 'profile.base.codex',
  'claude-endpoint': 'profile.base.claude-endpoint',
  'claude-deepseek': 'profile.base.claude-deepseek',
  custom: 'profile.base.custom',
};

export function templateName(
  t: Translate,
  template: Pick<TemplateInfo, 'id' | 'label' | 'builtin'>,
): string {
  const key = template.builtin ? KNOWN[template.id] : undefined;
  return key ? t(key) : template.label;
}

/** Translated texts of the built-in templates' fields; imported ones show what their file says. */
const FIELD_KEYS: Readonly<Record<string, { label: MessageKey; hint?: MessageKey }>> = {
  baseUrl: { label: 'profile.url', hint: 'profile.urlHint' },
  command: { label: 'profile.command' },
};

export function fieldTexts(
  t: Translate,
  template: Pick<TemplateInfo, 'builtin'>,
  field: Pick<TemplateField, 'key' | 'label' | 'hint'>,
): { label: string; hint: string } {
  const keys = template.builtin ? FIELD_KEYS[field.key] : undefined;
  if (!keys) return { label: field.label, hint: field.hint };
  return { label: t(keys.label), hint: keys.hint ? t(keys.hint) : '' };
}
