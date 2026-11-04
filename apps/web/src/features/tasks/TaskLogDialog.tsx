import type { Task } from '@deck/shared';
import { useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { usePolling } from '../../shared/ui/usePolling';

/** The output of a background command, refreshed while it is open. */
export function TaskLogDialog({ task, onClose }: { task: Task; onClose(): void }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  usePolling(() => api.taskLog(task.id).then(setText), 2000);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tasklog" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={`${t('tasks.logTitle')}: ${task.name}`} onClose={onClose} />
        <pre className="task-output">
          {text === null || text === '' ? t('tasks.noOutput') : text}
        </pre>
      </div>
    </div>
  );
}
