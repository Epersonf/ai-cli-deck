import type { ChatInfo } from '@deck/shared';
import { useEffect, useState } from 'react';
import { chatApi } from '../../shared/api/chatApi';
import { useT } from '../../shared/i18n/store';

const SHOWN = 8;
/** Typing a folder asks only once the typing stops. */
const DEBOUNCE_MS = 350;

interface Props {
  provider: string;
  cwd: string;
  disabled: boolean;
  onOpen(chatId: string): void;
}

const when = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

/** The conversations this profile already had in this folder: any of them continues in a new terminal. */
export function SavedChats({ provider, cwd, disabled, onOpen }: Props) {
  const t = useT();
  const [chats, setChats] = useState<ChatInfo[]>([]);

  useEffect(() => {
    const folder = cwd.trim();
    if (provider === '' || folder === '') return setChats([]);
    let live = true;
    const timer = window.setTimeout(() => {
      chatApi
        .list(provider, folder)
        .then((found) => live && setChats(found))
        .catch(() => live && setChats([]));
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [provider, cwd]);

  if (chats.length === 0) return null;
  return (
    <div className="saved-chats">
      <h3>{t('chat.saved')}</h3>
      <ul>
        {chats.slice(0, SHOWN).map((chat) => (
          <li key={chat.id}>
            <button type="button" disabled={disabled} onClick={() => onOpen(chat.id)}>
              <span className="saved-title">{chat.title}</span>
              <span className="saved-date">{when(chat.updatedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
