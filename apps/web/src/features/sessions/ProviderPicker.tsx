import { setupSpecFor, type ProviderInfo } from '@deck/shared';
import { useT } from '../../shared/i18n/store';

interface Props {
  providers: readonly ProviderInfo[];
  value: string;
  onChange(id: string): void;
}

/** Agent selector; flags the ones whose CLI is not installed and says how to get it. */
export function ProviderPicker({ providers, value, onChange }: Props) {
  const t = useT();
  const current = providers.find((p) => p.id === value);
  const command = current?.setupId ? setupSpecFor(current.setupId)?.install?.join(' ') : undefined;
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
          {command && <p className="hint">{t('provider.installCmd', { command })}</p>}
        </div>
      )}
      {current?.keyState === 'missing' && <p className="hint">{t('provider.keyMissing')}</p>}
    </>
  );
}
