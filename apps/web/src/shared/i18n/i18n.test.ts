import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { en } from './en';
import { DEFAULT_LOCALE, LOCALES, detectLocale } from './locales';
import { interpolate, makeTranslator } from './translate';

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

describe('catalog', () => {
  it('has a dictionary for every listed locale', () => {
    expect(Object.keys(CATALOG).sort()).toEqual(LOCALES.map((l) => l.code).sort());
  });

  it.each(LOCALES.map((l) => l.code))('%s defines exactly the English keys', (code) => {
    expect(Object.keys(CATALOG[code]).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(LOCALES.map((l) => l.code))(
    '%s keeps every {placeholder} of the English text',
    (code) => {
      for (const [key, english] of Object.entries(en)) {
        const translated = CATALOG[code][key as keyof typeof en];
        expect(placeholders(translated), `${code}:${key}`).toEqual(placeholders(english));
        expect(translated.trim(), `${code}:${key}`).not.toBe('');
      }
    },
  );

  it('really translates (other locales differ from English somewhere)', () => {
    for (const { code } of LOCALES) {
      if (code === 'en') continue;
      expect(CATALOG[code]['approvals.approve']).not.toBe(en['approvals.approve']);
    }
  });
});

describe('translator', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(interpolate('Hi {name}', { name: 'Ana' })).toBe('Hi Ana');
    expect(interpolate('Hi {name}', {})).toBe('Hi {name}');
    expect(interpolate('plain', undefined)).toBe('plain');
  });

  it('translates with parameters and falls back to English', () => {
    const t = makeTranslator(CATALOG, 'pt');
    expect(t('tabs.closeConfirm', { name: 'x' })).toBe('Fechar x? O processo será encerrado.');
    const partial = { ...CATALOG, fr: { ...CATALOG.fr, 'common.close': '' } };
    expect(makeTranslator(partial, 'fr')('common.close')).toBe('');
    expect(makeTranslator(CATALOG, DEFAULT_LOCALE)('common.close')).toBe('Close');
  });
});

describe('detectLocale', () => {
  it('prefers the saved choice, then the browser language, then English', () => {
    expect(detectLocale(['fr-FR'], 'ja')).toBe('ja');
    expect(detectLocale(['xx', 'pt-BR', 'en'], null)).toBe('pt');
    expect(detectLocale(['zh-TW'], null)).toBe('zh');
    expect(detectLocale(['de-DE'], null)).toBe('en');
    expect(detectLocale([], 'nope')).toBe('en');
  });
});
