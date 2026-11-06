import type { ChatInfo } from '@deck/shared';
import { useEffect, useState } from 'react';
import { chatApi } from '../../shared/api/chatApi';
import { useT } from '../../shared/i18n/store';
import { ChatPicker } from './ChatPicker';

/** Typing a folder asks only once the typing stops. */
const DEBOUNCE_MS = 350;

interface Props {
  provider: string;
  cwd: string;
  disabled: boolean;
  onOpen(chatId: string): void;
}

/**
 * The conversations this profile already had in this folder, behind one button (the dialog stays short):
 * it opens a picker where any of them continues in a new terminal.
 */
export function SavedChats({ provider, cwd, disabled, onOpen }: Props) {
  const t = useT();
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [open, setOpen] = useState(false);

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
    <>
      <button
        type="button"
        className="saved-chats-open"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {t('chat.load', { count: String(chats.length) })}
      </button>
      {open && (
        <ChatPicker
          chats={chats}
          disabled={disabled}
          onPick={(id) => (setOpen(false), onOpen(id))}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
