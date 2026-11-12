import { useT } from '../../shared/i18n/store';
import { sendChat } from './connection';
import { HeaderPopover } from './HeaderPopover';
import { runningCount, type ChatTask } from './tasks';
import { Gear } from '../../shared/ui/Gear';

/** The jobs the agent started in the background (a dev server, a build): a badge and a list with Stop. */
export function ChatTasks({ sessionId, tasks }: { sessionId: string; tasks: readonly ChatTask[] }) {
  const t = useT();
  if (tasks.length === 0) return null;
  const running = runningCount(tasks);
  return (
    <HeaderPopover
      title={t('chat.tasks')}
      label={
        <>
          <Gear size={16} teeth={8} />
          <span className={`badge${running > 0 ? ' live' : ''}`}>{running || tasks.length}</span>
        </>
      }
    >
      <h3>{t('chat.tasks')}</h3>
      <ul className="chat-task-list">
        {tasks.map((task) => (
          <li key={task.id}>
            <span className={`dot ${task.state}`} title={t(`tasks.status.${task.state}`)} />
            <span className="chat-task-title" title={task.title}>
              {task.title}
            </span>
            {task.state === 'running' ? (
              <button
                type="button"
                className="danger"
                onClick={() => sendChat(sessionId, { type: 'stop-task', id: task.id })}
              >
                {t('chat.task.stop')}
              </button>
            ) : (
              <small>{t(`tasks.status.${task.state}`)}</small>
            )}
          </li>
        ))}
      </ul>
    </HeaderPopover>
  );
}
