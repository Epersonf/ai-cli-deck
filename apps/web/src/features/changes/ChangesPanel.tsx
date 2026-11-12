import { useEffect, useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ChangeRow } from './ChangeRow';
import { useReview } from './useReview';
import { RefreshIcon } from '../../shared/ui/Icons';

interface Props {
  sessionId: string;
  visible: boolean;
}

/** What the agent changed in the session's repository: every file's diff, then discard, commit and push. */
export function ChangesPanel({ sessionId, visible }: Props) {
  const t = useT();
  const git = useReview(sessionId, visible);
  /** Files left out of the next commit; everything else is in. */
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => setVersion((v) => v + 1), [git.review]);

  const review = git.review;
  const changes = review?.changes ?? [];
  const chosen = changes.filter((c) => !skipped.has(c.path)).map((c) => c.path);
  const check = (path: string, on: boolean): void =>
    setSkipped((set) => {
      const next = new Set(set);
      if (on) next.delete(path);
      else next.add(path);
      return next;
    });
  const commit = (): void =>
    void git.commit(message, chosen).then((ok) => ok && (setMessage(''), setSkipped(new Set())));

  return (
    <section className={`pane changes-pane${visible ? '' : ' hidden'}`}>
      <header className="changes-head">
        <span className="changes-repo">
          {review?.isRepo ? `${review.repo ?? ''} · ${review.branch ?? t('changes.detached')}` : ''}
        </span>
        {review?.isRepo && (
          <button type="button" disabled={git.busy} onClick={() => void git.push()}>
            {review.ahead ? t('changes.pushN', { count: String(review.ahead) }) : t('changes.push')}
          </button>
        )}
        <button
          type="button"
          className="tool"
          title={t('common.refresh')}
          aria-label={t('common.refresh')}
          onClick={() => void git.refresh()}
        >
          <RefreshIcon size={16} />
        </button>
      </header>
      {git.error && <pre className="error changes-output">{git.error}</pre>}
      {git.output && <pre className="hint changes-output">{git.output}</pre>}
      {review && !review.isRepo && <p className="hint">{t('changes.notRepo')}</p>}
      {review?.isRepo && changes.length === 0 && <p className="hint">{t('changes.clean')}</p>}
      <ul className="changes-list">
        {changes.map((change) => (
          <ChangeRow
            key={change.path}
            sessionId={sessionId}
            change={change}
            checked={!skipped.has(change.path)}
            busy={git.busy}
            version={version}
            onCheck={(on) => check(change.path, on)}
            onDiscard={() => void git.discard(change.path)}
          />
        ))}
      </ul>
      {changes.length > 0 && (
        <div className="commit-box">
          <textarea
            value={message}
            rows={2}
            placeholder={t('changes.message')}
            aria-label={t('changes.message')}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={git.busy || message.trim() === '' || chosen.length === 0}
            onClick={commit}
          >
            {t('changes.commitN', { count: String(chosen.length) })}
          </button>
        </div>
      )}
    </section>
  );
}
