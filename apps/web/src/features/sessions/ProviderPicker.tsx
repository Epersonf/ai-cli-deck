import type { ProviderInfo } from '@deck/shared';

interface Props {
  providers: readonly ProviderInfo[];
  value: string;
  onChange(id: string): void;
  onInstall(): void;
  disabled: boolean;
}

/** CLI selector; flags CLIs that are not installed and offers to download them in a terminal. */
export function ProviderPicker({ providers, value, onChange, onInstall, disabled }: Props) {
  const current = providers.find((p) => p.id === value);
  return (
    <>
      <label>
        CLI
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.status === 'missing' ? ' — not installed' : ''}
            </option>
          ))}
        </select>
      </label>
      {current?.status === 'missing' && (
        <div className="notice error">
          <p>{current.hint}</p>
          {current.canInstall && (
            <>
              <button type="button" onClick={onInstall} disabled={disabled}>
                Install in terminal
              </button>
              <p className="hint">
                Downloads it for you. When you start it, the CLI asks you to sign in by itself.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
