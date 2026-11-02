import { useT } from '../../shared/i18n/store';
import { KEYS_MODES, type KeysMode } from '../terminal/keysPreference';

interface Props {
  mode: KeysMode;
  touchScreen: boolean;
  onChange(mode: KeysMode): void;
}

/** Explains the on-screen keys bar (Esc, Tab, Ctrl, arrows...) and lets the user force it. */
export function KeysSection({ mode, touchScreen, onChange }: Props) {
  const t = useT();
  const labels = { auto: t('keys.auto'), on: t('keys.on'), off: t('keys.off') } as const;
  const helps = { auto: t('keys.autoHelp'), on: t('keys.onHelp'), off: t('keys.offHelp') } as const;
  const device = t(touchScreen ? 'keys.deviceTouch' : 'keys.deviceDesktop');
  return (
    <div className="setting">
      <label>
        {t('keys.title')}
        <select
          value={mode}
          onChange={(e) => {
            const next = KEYS_MODES.find((m) => m === e.target.value);
            if (next) onChange(next);
          }}
        >
          {KEYS_MODES.map((m) => (
            <option key={m} value={m}>
              {labels[m]}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{helps[mode]}</p>
      <p className="hint">{t('keys.about', { device })}</p>
    </div>
  );
}
