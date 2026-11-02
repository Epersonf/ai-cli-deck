import { useRef, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';

interface Props {
  sessionId: string;
  dir: string;
  onDone(): void;
}

/** Uploads files straight into the folder being browsed (button/picker, works on phones too). */
export function useUpload({ sessionId, dir, onDone }: Props) {
  const t = useT();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: readonly File[]): Promise<void> => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    let done = 0;
    try {
      for (const file of files) {
        setNote(t('files.uploading', { name: file.name, done: done + 1, total: files.length }));
        await api.upload(sessionId, dir, file);
        done += 1;
      }
      setNote(t('files.uploaded', { count: done }));
    } catch (e) {
      setNote(t('files.uploadFailed', { error: e instanceof Error ? e.message : 'failed' }));
    } finally {
      setBusy(false);
      onDone();
    }
  };
  return { upload, note, busy };
}

interface ButtonProps {
  busy: boolean;
  onFiles(files: File[]): void;
}

export function UploadButton({ busy, onFiles }: ButtonProps) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        ⬆ {t('files.upload')}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </>
  );
}
