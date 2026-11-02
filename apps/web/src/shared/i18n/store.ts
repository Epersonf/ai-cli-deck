import { create } from 'zustand';
import { CATALOG } from './catalog';
import { DEFAULT_LOCALE, LOCALES, detectLocale, type LocaleCode } from './locales';
import { makeTranslator, type Params } from './translate';
import type { MessageKey } from './en';

const KEY = 'deck-locale';

function saved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function apply(locale: LocaleCode): void {
  document.documentElement.lang = LOCALES.find((l) => l.code === locale)?.html ?? 'en';
}

interface LocaleState {
  locale: LocaleCode;
  setLocale(locale: LocaleCode): void;
}

export const useLocale = create<LocaleState>()((set) => {
  const initial = detectLocale(navigator.languages ?? [DEFAULT_LOCALE], saved());
  apply(initial);
  return {
    locale: initial,
    setLocale(locale) {
      try {
        localStorage.setItem(KEY, locale);
      } catch {
        // the choice only lasts for this page load
      }
      apply(locale);
      set({ locale });
    },
  };
});

export type Translate = (key: MessageKey, params?: Params) => string;

/** Translator bound to the current language; components re-render when it changes. */
export function useT(): Translate {
  const locale = useLocale((s) => s.locale);
  return makeTranslator(CATALOG, locale);
}

/** For code outside React (stores, socket handlers). */
export const translateNow: Translate = (key, params) =>
  makeTranslator(CATALOG, useLocale.getState().locale)(key, params);
