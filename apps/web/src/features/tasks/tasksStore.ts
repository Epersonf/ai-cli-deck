import type { Task } from '@deck/shared';
import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';

interface TasksState {
  tasks: Task[];
  refresh(): Promise<void>;
}

/** Background tasks of every terminal; the drawer refreshes it while it is open. */
export const useTasks = create<TasksState>()((set) => ({
  tasks: [],
  async refresh() {
    set({ tasks: await api.tasks() });
  },
}));
