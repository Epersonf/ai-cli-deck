import { useT } from '../../shared/i18n/store';
import type { KeysMode } from '../terminal/keysPreference';

interface Props {
  mode: KeysMode;
  touchScreen: boolean;
  onChange(mode: KeysMode): void;
}

/** Explains the on-screen keys bar (Esc, Tab, Ctrl, arrows...) and lets the user force it. */
export function KeysSection({ mode, touchScreen, onChange }: Props) {
  const t = useT();
  const options = [
    { mode: 'auto', label: t('keys.auto'), help: t('keys.autoHelp') },
    { mode: 'on', label: t('keys.on'), help: t('keys.onHelp') },
    { mode: 'off', label: t('keys.off'), help: t('keys.offHelp') },
  ] as const;
  const device = t(touchScreen ? 'keys.deviceTouch' : 'keys.deviceDesktop');
  return (
    <fieldset className="setting">
      <legend>{t('keys.title')}</legend>
      <p className="hint">{t('keys.about', { device })}</p>
      {options.map((option) => (
        <label className="choice" key={option.mode}>
          <input
            type="radio"
            name="keys-mode"
            checked={mode === option.mode}
            onChange={() => onChange(option.mode)}
          />
          <span>
            <strong>{option.label}</strong>
            <small>{option.help}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
