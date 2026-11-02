import { useT } from '../../shared/i18n/store';
import type { KeysMode } from '../terminal/keysPreference';
import { KeysSection } from './KeysSection';
import { LanguageSection } from './LanguageSection';
import { PasswordSection } from './PasswordSection';

interface Props {
  keysMode: KeysMode;
  touchScreen: boolean;
  onKeysChange(mode: KeysMode): void;
  onClose(): void;
}

export function SettingsDialog({ keysMode, touchScreen, onKeysChange, onClose }: Props) {
  const t = useT();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>{t('settings.title')}</h2>
        <LanguageSection />
        <KeysSection mode={keysMode} touchScreen={touchScreen} onChange={onKeysChange} />
        <div className="setting">
          <h3>{t('shortcuts.title')}</h3>
          <p className="hint">{t('shortcuts.body')}</p>
        </div>
        <PasswordSection />
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
