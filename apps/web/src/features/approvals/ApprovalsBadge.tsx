import { useT } from '../../shared/i18n/store';
import { useApprovals } from './approvalsStore';

export function ApprovalsBadge() {
  const t = useT();
  const count = useApprovals((s) => s.pending.length);
  const setOpen = useApprovals((s) => s.setOpen);
  return (
    <button
      type="button"
      className={`approvals-badge${count > 0 ? ' attention' : ''}`}
      onClick={() => setOpen(true)}
      aria-label={t('approvals.aria', { count })}
      title={t('approvals.title')}
    >
      ✋ {count}
    </button>
  );
}
