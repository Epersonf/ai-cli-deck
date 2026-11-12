import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { PencilIcon } from '../../shared/ui/Icons';
import type { Attachment } from './blocks';
import { sendChat } from './connection';
import { FileIcon } from '../../shared/ui/ShapeIcons';

interface Props {
  sessionId: string;
  id: string;
  text: string;
  attachments: Attachment[];
  /** An answer is being written: editing waits (the person can stop it first). */
  busy: boolean;
}

/** The person's message: a plate with a pencil that opens an editor (the chat goes back to this point). */
export function UserMessage({ sessionId, id, text, attachments, busy }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [revert, setRevert] = useState(false);

  const save = (): void => {
    const next = draft.trim();
    if (next === '') return;
    sendChat(sessionId, { type: 'rewind', id, text: next, images: [], revertFiles: revert });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="msg user editing">
        <div className="bubble edit-box">
          <textarea
            autoFocus
            rows={3}
            value={draft}
            aria-label={t('chat.edit')}
            onChange={(e) => setDraft(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={revert} onChange={(e) => setRevert(e.target.checked)} />
            {t('chat.edit.revert')}
          </label>
          <p className="hint">{t('chat.edit.hint')}</p>
          <div className="row">
            <button type="button" className="primary" disabled={draft.trim() === ''} onClick={save}>
              {t('chat.edit.save')}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="msg user">
      <div className="bubble">
        {attachments.length > 0 && (
          <div className="chips">
            {attachments.map((a, i) => (
              <span key={i} className="chip">
                <FileIcon size={14} kind={a.mediaType.startsWith('image/') ? 'image' : 'pdf'} />{' '}
                {a.name ?? a.mediaType}
              </span>
            ))}
          </div>
        )}
        <p className="user-text">{text}</p>
        {!busy && (
          <button
            type="button"
            className="bubble-edit"
            aria-label={t('chat.edit')}
            title={t('chat.edit')}
            onClick={() => (setDraft(text), setRevert(false), setEditing(true))}
          >
            <PencilIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
