import type { GitDiff } from '@deck/shared';
import { useEffect, useState } from 'react';
import { gitApi } from '../../shared/api/reviewApi';
import { useT } from '../../shared/i18n/store';

/** The class a diff line is drawn with. */
export function lineKind(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'meta';
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'del';
  if (line.startsWith('@@')) return 'hunk';
  if (/^(diff |index |similarity |rename |new file|deleted file)/.test(line)) return 'meta';
  return '';
}

/** One file's diff against the last commit, fetched when opened. */
export function DiffView({
  sessionId,
  path,
  version,
}: {
  sessionId: string;
  path: string;
  version: number;
}) {
  const t = useT();
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    gitApi
      .diff(sessionId, path)
      .then((d) => live && (setDiff(d), setError(null)))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'failed'));
    return () => void (live = false);
  }, [sessionId, path, version]);

  if (error) return <p className="error">{error}</p>;
  if (!diff) return <p className="hint">{t('common.loading')}</p>;
  if (diff.diff.trim() === '') return <p className="hint">{t('changes.noDiff')}</p>;
  return (
    <pre className="diff">
      {diff.diff.split('\n').map((line, i) => (
        <span key={i} className={lineKind(line)}>
          {line}
          {'\n'}
        </span>
      ))}
      {diff.truncated && <span className="meta">{t('changes.truncated')}</span>}
    </pre>
  );
}
