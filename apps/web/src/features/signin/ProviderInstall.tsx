import { useState } from 'react';
import type { ProviderInfo } from '@deck/shared';
import { installProvider } from '../../shared/api/providerInstallApi';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from '../sessions/profilesStore';

/** Every provider package supplies its own installer; this UI only displays its result. */
export function ProviderInstall({
  info,
  onInstalled,
}: {
  info: ProviderInfo;
  onInstalled(): void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState('');
  const install = async (): Promise<void> => {
    setBusy(true);
    setOutput('');
    try {
      const result = await installProvider(info.id);
      setOutput(result.output);
      await useProfiles.getState().refresh();
      if (result.ok) onInstalled();
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Installation failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="signin-install">
      <p>{t('signin.installMissing', { name: info.label })}</p>
      <button
        type="button"
        className="primary"
        disabled={busy || !info.canInstall}
        onClick={() => void install()}
      >
        {t(busy ? 'signin.installing' : 'signin.install')}
      </button>
      {output !== '' && <pre className="signin-output">{output}</pre>}
    </div>
  );
}
