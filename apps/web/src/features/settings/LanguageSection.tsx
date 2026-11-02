import { LOCALES, type LocaleCode } from '../../shared/i18n/locales';
import { useLocale, useT } from '../../shared/i18n/store';

export function LanguageSection() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  return (
    <div className="setting">
      <label>
        {t('settings.language')}
        <select value={locale} onChange={(e) => setLocale(e.target.value as LocaleCode)}>
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
