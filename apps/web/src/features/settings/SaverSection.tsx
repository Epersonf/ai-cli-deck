import { useT } from '../../shared/i18n/store';
import { useSaver, type SaverPref } from '../../shared/power/saverStore';

const PREFS: SaverPref[] = ['auto', 'on', 'off'];

/** Energy saving: ask the server less often. Automatic = in the Android app, or when the battery is low. */
export function SaverSection() {
  const t = useT();
  const pref = useSaver((s) => s.pref);
  const saving = useSaver((s) => s.saving);
  return (
    <div className="setting">
      <h3>{t('saver.title')}</h3>
      <select
        value={pref}
        onChange={(event) => useSaver.getState().setPref(event.target.value as SaverPref)}
      >
        {PREFS.map((value) => (
          <option key={value} value={value}>
            {t(`saver.${value}`)}
          </option>
        ))}
      </select>
      <p className="hint">{t(saving ? 'saver.nowOn' : 'saver.nowOff')}</p>
      <p className="hint">{t('saver.hint')}</p>
    </div>
  );
}
