import type { Task } from '@deck/shared';
import { useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { KebabMenu } from '../../shared/ui/KebabMenu';
import { TaskLogDialog } from './TaskLogDialog';
import { useTasks } from './tasksStore';

/** The background tasks of one profile, under its terminals: commands that keep running and watchers. */
export function TasksSection({ profileId }: { profileId: string }) {
  const t = useT();
  const tasks = useTasks((s) => s.tasks).filter((task) => task.profile === profileId);
  const [viewing, setViewing] = useState<Task | null>(null);
  if (tasks.length === 0) return null;
  const clear = (task: Task): void =>
    void api
      .removeTask(task.id)
      .then(() => useTasks.getState().refresh())
      .catch(() => undefined);
  return (
    <section className="tasks">
      <h4>{t('tasks.title')}</h4>
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id}>
            <span className={`dot ${task.status}`} title={t(`tasks.status.${task.status}`)} />
            <span className="task-main">
              <strong>{task.name}</strong>
              {task.detail !== '' && <small>{task.detail}</small>}
            </span>
            <KebabMenu
              items={[
                ...(task.kind === 'process'
                  ? [{ label: t('tasks.view'), onSelect: () => setViewing(task) }]
                  : []),
                {
                  label: task.status === 'running' ? t('tasks.stopClear') : t('tasks.clear'),
                  danger: true,
                  onSelect: () => clear(task),
                },
              ]}
            />
          </li>
        ))}
      </ul>
      {viewing && <TaskLogDialog task={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
