import { useState } from 'react';
import type { ProviderPluginManifest } from '@deck/shared';
import { pluginApi, pluginFileData } from '../../shared/api/pluginApi';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { useConfirm } from '../confirm/confirmStore';
import { useProfiles } from '../sessions/profilesStore';

/** Read the manifest first. Executable modules are imported only after the user confirms. */
export function ImportPluginDialog({
  onClose,
  onImported,
}: {
  onClose(): void;
  onImported(name: string): void;
}) {
  const t = useT();
  const ask = useConfirm((state) => state.ask);
  const [data, setData] = useState('');
  const [manifest, setManifest] = useState<ProviderPluginManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const select = async (file: File): Promise<void> => {
    setBusy(true);
    setData('');
    setManifest(null);
    setError(null);
    try {
      const encoded = await pluginFileData(file);
      setManifest(await pluginApi.inspect(encoded));
      setData(encoded);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid package');
    } finally {
      setBusy(false);
    }
  };
  const install = (): void => {
    if (!manifest || busy) return;
    ask({
      title: t('plugins.import'),
      message: t('plugins.warning'),
      confirmLabel: t('templates.import'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        setBusy(true);
        pluginApi
          .install(data)
          .then(() => useProfiles.getState().refreshTemplates())
          .then(() => onImported(manifest.template.label))
          .catch((error: unknown) =>
            setError(error instanceof Error ? error.message : 'Import failed'),
          )
          .finally(() => setBusy(false));
      },
    });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal templates" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('plugins.import')} onClose={onClose} />
        <label className="btn file-button">
          {t('templates.chooseFile')}
          <input
            type="file"
            accept=".zip,application/zip"
            hidden
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void select(file);
            }}
          />
        </label>
        {manifest && (
          <p>
            <strong>{manifest.template.label}</strong> · {manifest.version}
            <br />
            {manifest.template.description}
            <br />
            {manifest.authMethods.map((method) => method.label).join(' · ')}
          </p>
        )}
        <p className="hint warn-text">{t('plugins.warning')}</p>
        {error && <p className="notice error">{error}</p>}
        <button type="button" className="primary" disabled={busy || !manifest} onClick={install}>
          {t('templates.import')}
        </button>
      </div>
    </div>
  );
}
