import { ApprovalsBadge } from './features/approvals/ApprovalsBadge';
import { sessionLabel } from './features/sessions/sessionLabel';
import { useProfiles } from './features/sessions/profilesStore';
import { useActiveSession } from './features/sessions/sessionsStore';
import { useT } from './shared/i18n/store';
import { Gear } from './shared/ui/Gear';
import { useTerminalTools } from './features/terminal/toolsStore';
import { MenuIcon, ToolsIcon } from './shared/ui/Icons';
import { RemoteBadge } from './features/devices/RemoteBadge';

interface Props {
  wide: boolean;
  splitOn: boolean;
  /** The files/preview panel only exists once there is a terminal to browse. */
  hasSession: boolean;
  onSwitcher(): void;
  onSplit(): void;
  onSettings(): void;
}

export function Topbar({ wide, splitOn, hasSession, onSwitcher, onSplit, onSettings }: Props) {
  const t = useT();
  const active = useActiveSession();
  const providers = useProfiles((s) => s.providers);
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
      <RemoteBadge />
      <strong className="current-name">
        {active ? sessionLabel(active, providers) : t('switcher.empty')}
      </strong>
      {wide && hasSession && (
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
      {active && (
        <button
          type="button"
          className="tool"
          onClick={() => useTerminalTools.getState().toggle(active.id)}
          title={t('tools.open')}
          aria-label={t('tools.open')}
        >
          <ToolsIcon />
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
