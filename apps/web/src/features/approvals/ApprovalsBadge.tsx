import { useApprovals } from './approvalsStore';

export function ApprovalsBadge() {
  const count = useApprovals((s) => s.pending.length);
  const setOpen = useApprovals((s) => s.setOpen);
  return (
    <button
      type="button"
      className={`approvals-badge${count > 0 ? ' attention' : ''}`}
      onClick={() => setOpen(true)}
      aria-label={`${count} pending approvals`}
    >
      ✋ {count}
    </button>
  );
}
