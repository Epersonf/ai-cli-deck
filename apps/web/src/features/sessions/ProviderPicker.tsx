import type { ProviderInfo } from '@deck/shared';
import { useT } from '../../shared/i18n/store';

interface Props {
  providers: readonly ProviderInfo[];
  value: string;
  onChange(id: string): void;
  onInstall(): void;
  disabled: boolean;
}

/** CLI selector; flags CLIs that are not installed and offers to download them in a terminal. */
export function ProviderPicker({ providers, value, onChange, onInstall, disabled }: Props) {
  const t = useT();
  const current = providers.find((p) => p.id === value);
  return (
    <>
      <label>
        {t('newSession.cli')}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.status === 'missing' ? t('provider.notInstalledSuffix') : ''}
            </option>
          ))}
        </select>
      </label>
      {current?.status === 'missing' && (
        <div className="notice error">
          <p>{t('provider.missing', { name: current.label })}</p>
          {current.canInstall && (
            <>
              <button type="button" onClick={onInstall} disabled={disabled}>
                {t('provider.install')}
              </button>
              <p className="hint">{t('provider.installHint')}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
