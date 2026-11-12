import { useState } from 'react';
import { PEER_ID } from '../../shared/api/base';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { LanguageSection } from './LanguageSection';
import { SaverSection } from './SaverSection';
import { PasswordDialog } from './PasswordDialog';
import { TemplatesDialog } from './TemplatesDialog';
import { useMemory } from '../memory/memoryStore';
import { DevicesDialog } from '../devices/DevicesDialog';

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  if (passwordOpen) return <PasswordDialog onClose={() => setPasswordOpen(false)} />;
  if (templatesOpen) return <TemplatesDialog onClose={() => setTemplatesOpen(false)} />;
  if (devicesOpen) return <DevicesDialog onClose={() => setDevicesOpen(false)} />;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('settings.title')} onClose={onClose} />
        <div className="setting memory-entry">
          <h3>{t('memory.title')}</h3>
          <p className="hint">{t('memory.settingsHint')}</p>
          <button
            type="button"
            className="primary"
            onClick={() => (onClose(), useMemory.getState().show(null, true))}
          >
            {t('memory.open')}
          </button>
        </div>
        <LanguageSection />
        <SaverSection />
        <div className="setting">
          <h3>{t('shortcuts.title')}</h3>
          <p className="hint">{t('shortcuts.body')}</p>
        </div>
        {!PEER_ID && (
          <div className="setting">
            <h3>{t('devices.title')}</h3>
            <p className="hint">{t('devices.hint')}</p>
            <button type="button" onClick={() => setDevicesOpen(true)}>
              {t('devices.open')}
            </button>
          </div>
        )}
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
