import { mediaKindOf, type FileContent } from '@deck/shared';
import { useEffect, useState } from 'react';
import { api, rawUrl } from '../../shared/api/endpoints';

interface Props {
  sessionId: string;
  path: string;
  onClose(): void;
}

function TextBody({ sessionId, path, raw }: { sessionId: string; path: string; raw: string }) {
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
  if (file === null) return <p className="hint">Loading…</p>;
  if (file.binary) {
    return (
      <p className="empty">
        Binary file ({file.size} bytes).{' '}
        <a href={raw} target="_blank" rel="noopener noreferrer">
          Open raw ↗
        </a>
      </p>
    );
  }
  return (
    <>
      {file.truncated && (
        <p className="notice">Showing the first part of a {file.size}-byte file.</p>
      )}
      <pre className="code">{file.content}</pre>
    </>
  );
}

/** Shows text, images, audio, video and PDFs from the session folder. */
export function FileViewer({ sessionId, path, onClose }: Props) {
  const kind = mediaKindOf(path);
  const raw = rawUrl(sessionId, path);
  return (
    <div className="file-viewer">
      <div className="viewer-bar">
        <button type="button" onClick={onClose}>
          ← Files
        </button>
        <span className="viewer-title">{path}</span>
        <a className="btn" href={raw} target="_blank" rel="noopener noreferrer">
          Open ↗
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
