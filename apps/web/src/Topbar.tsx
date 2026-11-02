import { ApprovalsBadge } from './features/approvals/ApprovalsBadge';
import { SessionTabs } from './features/sessions/SessionTabs';
import { useT } from './shared/i18n/store';
import { Gear } from './shared/ui/Gear';

interface Props {
  wide: boolean;
  splitOn: boolean;
  onNew(): void;
  onSwitcher(): void;
  onSplit(): void;
  onSettings(): void;
}

export function Topbar({ wide, splitOn, onNew, onSwitcher, onSplit, onSettings }: Props) {
  const t = useT();
  return (
    <header className="topbar">
      <span className="brand">
        <Gear size={24} className="spin" />
        <strong>Deck</strong>
      </span>
      <SessionTabs onNew={onNew} />
      <button
        type="button"
        className="tool"
        onClick={onSwitcher}
        title={t('topbar.sessions')}
        aria-label={t('topbar.sessions')}
      >
        ☰
      </button>
      {wide && (
        <button
          type="button"
          className={`tool${splitOn ? ' on' : ''}`}
          onClick={onSplit}
          title={t('topbar.split')}
          aria-label={t('topbar.split')}
          aria-pressed={splitOn}
        >
          <span className="icon-split" aria-hidden />
        </button>
      )}
      <button
        type="button"
        className="tool"
        onClick={onSettings}
        title={t('topbar.settings')}
        aria-label={t('topbar.settings')}
      >
        ⚙
      </button>
      <ApprovalsBadge />
    </header>
  );
}
