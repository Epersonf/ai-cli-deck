export const LOCALES = [
  { code: 'en', name: 'English', html: 'en' },
  { code: 'pt', name: 'Português (Brasil)', html: 'pt-BR' },
  { code: 'es', name: 'Español', html: 'es' },
  { code: 'it', name: 'Italiano', html: 'it' },
  { code: 'fr', name: 'Français', html: 'fr' },
  { code: 'zh', name: '中文（简体）', html: 'zh-CN' },
  { code: 'ja', name: '日本語', html: 'ja' },
  { code: 'ru', name: 'Русский', html: 'ru' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];
export const DEFAULT_LOCALE: LocaleCode = 'en';

const isLocale = (value: string | null): value is LocaleCode =>
  LOCALES.some((locale) => locale.code === value);

/** A saved choice wins; otherwise the first browser language we support; otherwise English. */
export function detectLocale(languages: readonly string[], saved: string | null): LocaleCode {
  if (isLocale(saved)) return saved;
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0] ?? '';
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
