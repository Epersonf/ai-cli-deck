import { en, type MessageKey, type Messages } from './en';
import { DEFAULT_LOCALE, type LocaleCode } from './locales';

export type Params = Readonly<Record<string, string | number>>;
export type Catalog = Readonly<Record<LocaleCode, Messages>>;

/** Fills `{name}` placeholders; unknown placeholders are left visible rather than hidden. */
export function interpolate(template: string, params: Params | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params[name] ?? whole));
}

export function makeTranslator(catalog: Catalog, locale: LocaleCode) {
  return (key: MessageKey, params?: Params): string =>
    interpolate(catalog[locale]?.[key] ?? catalog[DEFAULT_LOCALE]?.[key] ?? en[key], params);
}
