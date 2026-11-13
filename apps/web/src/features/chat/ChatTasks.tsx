import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { sendChat } from './connection';
import { HeaderPopover } from './HeaderPopover';
import { runningCount, type ChatTask } from './tasks';
import { Gear } from '../../shared/ui/Gear';
import { ModalTitle } from '../../shared/ui/ModalTitle';

/** The jobs the agent started in the background (a dev server, a build): a badge and a list with Stop. */
export function ChatTasks({
  sessionId,
  tasks: all,
}: {
  sessionId: string;
  tasks: readonly ChatTask[];
}) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const key = `deck.dismissed-tasks.${sessionId}`;
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  // A finished task can be dismissed; one that runs again shows again.
  const tasks = all.filter((task) => task.state === 'running' || !dismissed.includes(task.id));
  const dismiss = (ids: string[]): void => {
    const next = [...new Set([...dismissed, ...ids])].slice(-200);
    setDismissed(next);
    setOpenId(null);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage is full or off: the dismissal lasts until reload */
    }
  };
  const finished = tasks.filter((task) => task.state !== 'running');
  if (tasks.length === 0) return null;
  const detail = tasks.find((task) => task.id === openId) ?? null;
  const stop = (id: string): void => sendChat(sessionId, { type: 'stop-task', id });
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
            <button type="button" className="chat-task-title" onClick={() => setOpenId(task.id)}>
              {task.title}
            </button>
            {task.state === 'running' ? (
              <button type="button" className="danger" onClick={() => stop(task.id)}>
                {t('chat.task.stop')}
              </button>
            ) : (
              <small>{t(`tasks.status.${task.state}`)}</small>
            )}
          </li>
        ))}
      </ul>
      {finished.length > 0 && (
        <button type="button" onClick={() => dismiss(finished.map((task) => task.id))}>
          {t('chat.task.dismiss')} ({finished.length})
        </button>
      )}
      {detail !== null && (
        <div className="modal-backdrop" onClick={() => setOpenId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <ModalTitle title={t('chat.tasks')} onClose={() => setOpenId(null)} />
            <p>
              <span className={`dot ${detail.state}`} />{' '}
              <small>{t(`tasks.status.${detail.state}`)}</small>
            </p>
            <pre className="chat-task-full">{detail.title}</pre>
            {detail.state !== 'running' && (
              <button type="button" onClick={() => dismiss([detail.id])}>
                {t('chat.task.dismiss')}
              </button>
            )}
            {detail.state === 'running' && (
              <button type="button" className="danger" onClick={() => stop(detail.id)}>
                {t('chat.task.stop')}
              </button>
            )}
          </div>
        </div>
      )}
    </HeaderPopover>
  );
}
