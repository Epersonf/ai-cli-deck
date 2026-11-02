import { ApprovalsBadge } from './features/approvals/ApprovalsBadge';
import { sessionLabel } from './features/sessions/sessionLabel';
import { useActiveSession } from './features/sessions/sessionsStore';
import { useT } from './shared/i18n/store';
import { Gear } from './shared/ui/Gear';
import { MenuIcon } from './shared/ui/Icons';

interface Props {
  wide: boolean;
  splitOn: boolean;
  onSwitcher(): void;
  onSplit(): void;
  onSettings(): void;
}

export function Topbar({ wide, splitOn, onSwitcher, onSplit, onSettings }: Props) {
  const t = useT();
  const active = useActiveSession();
  return (
    <header className="topbar">
      <button
        type="button"
        className="tool"
        onClick={onSwitcher}
        title={t('topbar.sessions')}
        aria-label={t('topbar.sessions')}
      >
        <MenuIcon />
      </button>
      <span className="brand">
        <Gear size={22} className="spin" />
      </span>
      <strong className="current-name">
        {active ? sessionLabel(active) : t('switcher.empty')}
      </strong>
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
