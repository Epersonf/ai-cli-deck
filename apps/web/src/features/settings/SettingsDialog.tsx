import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import type { KeysMode } from '../terminal/keysPreference';
import { KeysSection } from './KeysSection';
import { LanguageSection } from './LanguageSection';
import { PromptsDialog } from '../prompts/PromptsDialog';
import { PasswordDialog } from './PasswordDialog';
import { TemplatesDialog } from './TemplatesDialog';

interface Props {
  keysMode: KeysMode;
  touchScreen: boolean;
  onKeysChange(mode: KeysMode): void;
  onClose(): void;
}

export function SettingsDialog({ keysMode, touchScreen, onKeysChange, onClose }: Props) {
  const t = useT();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  if (passwordOpen) return <PasswordDialog onClose={() => setPasswordOpen(false)} />;
  if (promptsOpen) return <PromptsDialog onClose={() => setPromptsOpen(false)} />;
  if (templatesOpen) return <TemplatesDialog onClose={() => setTemplatesOpen(false)} />;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('settings.title')} onClose={onClose} />
        <LanguageSection />
        <KeysSection mode={keysMode} touchScreen={touchScreen} onChange={onKeysChange} />
        <div className="setting">
          <h3>{t('shortcuts.title')}</h3>
          <p className="hint">{t('shortcuts.body')}</p>
        </div>
        <div className="setting">
          <h3>{t('prompts.title')}</h3>
          <p className="hint">{t('prompts.settingsHint')}</p>
          <button type="button" onClick={() => setPromptsOpen(true)}>
            {t('prompts.open')}
          </button>
        </div>
        <div className="setting">
          <h3>{t('templates.title')}</h3>
          <p className="hint">{t('templates.settingsHint')}</p>
          <button type="button" onClick={() => setTemplatesOpen(true)}>
            {t('templates.open')}
          </button>
        </div>
        <div className="setting">
          <h3>{t('password.title')}</h3>
          <button type="button" onClick={() => setPasswordOpen(true)}>
            {t('password.open')}
          </button>
        </div>
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
