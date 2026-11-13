import { mediaKindOf, type FileContent } from '@deck/shared';
import { useEffect, useState } from 'react';
import { api, downloadUrl, rawUrl } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { mentionInChat } from './mention';
import { DownloadIcon, ExternalIcon } from '../../shared/ui/GlyphIcons';

interface Props {
  sessionId: string;
  path: string;
  onClose(): void;
}

function TextBody({ sessionId, path, raw }: { sessionId: string; path: string; raw: string }) {
  const t = useT();
  const [file, setFile] = useState<FileContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFile(null);
    api
      .file(sessionId, path)
      .then(setFile)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  }, [sessionId, path]);

  if (error !== null) return <p className="notice error">{error}</p>;
  if (file === null) return <p className="hint">{t('common.loading')}</p>;
  if (file.binary) {
    return (
      <p className="empty">
        {t('files.binary', { size: file.size })}{' '}
        <a href={raw} target="_blank" rel="noopener noreferrer">
          {t('files.openRaw')} <ExternalIcon size={14} />
        </a>
      </p>
    );
  }
  return (
    <>
      {file.truncated && <p className="notice">{t('files.truncated', { size: file.size })}</p>}
      <pre className="code">{file.content}</pre>
    </>
  );
}

/** Shows text, images, audio, video and PDFs from the session folder. */
export function FileViewer({ sessionId, path, onClose }: Props) {
  const t = useT();
  const kind = mediaKindOf(path);
  const raw = rawUrl(sessionId, path);
  return (
    <div className="file-viewer">
      <div className="viewer-bar">
        <button type="button" onClick={onClose}>
          ← {t('common.back')}
        </button>
        <span className="viewer-title">{path}</span>
        <a className="btn" href={raw} target="_blank" rel="noopener noreferrer">
          {t('common.open')} <ExternalIcon size={14} />
        </a>
        <button type="button" onClick={() => mentionInChat(sessionId, path, t('files.mentioned'))}>
          {t('files.mention')}
        </button>
        <a className="btn" href={downloadUrl(sessionId, path)} download>
          <DownloadIcon size={16} /> {t('files.download')}
        </a>
      </div>
      <div className="viewer-body">
        {kind === 'image' && <img src={raw} alt={path} />}
        {kind === 'audio' && <audio src={raw} controls preload="metadata" />}
        {kind === 'video' && <video src={raw} controls playsInline preload="metadata" />}
        {kind === 'pdf' && <iframe src={raw} title={path} />}
        {kind === 'text' && <TextBody sessionId={sessionId} path={path} raw={raw} />}
      </div>
    </div>
  );
}
