import type { ApprovalDecision, ApprovalRequest } from '@deck/shared';
import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';

interface ApprovalsState {
  pending: ApprovalRequest[];
  open: boolean;
  refresh(): Promise<void>;
  receive(request: ApprovalRequest): void;
  decide(id: string, decision: ApprovalDecision): Promise<void>;
  setOpen(open: boolean): void;
}

export const useApprovals = create<ApprovalsState>()((set, get) => ({
  pending: [],
  open: false,
  async refresh() {
    set({ pending: await api.approvals() });
  },
  receive(request) {
    const rest = get().pending.filter((r) => r.id !== request.id);
    set({ pending: request.status === 'pending' ? [...rest, request] : rest });
  },
  async decide(id, decision) {
    const updated = await api.decide(id, decision);
    get().receive(updated);
  },
  setOpen: (open) => set({ open }),
}));
