import type { ChatInfo } from '@deck/shared';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';

/** Rows drawn at most: the search narrows the rest. */
const SHOWN = 60;

interface Props {
  chats: ChatInfo[];
  disabled: boolean;
  onPick(chatId: string): void;
  onClose(): void;
}

const when = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

/** Lower case without accents, so a search matches either way. */
const plain = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** A searchable list of a profile's saved conversations; drawn over the new-session dialog. */
export function ChatPicker({ chats, disabled, onPick, onClose }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  const found = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return chats.filter((chat) => words.every((word) => plain(chat.title).includes(word)));
  }, [chats, query]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal chat-picker" onClick={(e) => e.stopPropagation()}>
        <ModalTitle title={t('chat.saved')} onClose={onClose} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('chat.search')}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {found.length === 0 && <p className="chat-picker-empty">{t('chat.noMatch')}</p>}
        <ul>
          {found.slice(0, SHOWN).map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                disabled={disabled}
                title={chat.title}
                onClick={() => onPick(chat.id)}
              >
                <span className="saved-title">{chat.title}</span>
                <span className="saved-date">{when(chat.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
