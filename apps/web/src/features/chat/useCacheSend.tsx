import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { useChat, useChats } from './chatStore';
import { cacheWarning, type CacheWarning } from './cacheWarning';
import { tokens } from './usageFormat';

/** Keep the draft and attachments intact until the user confirms this send. */
export function useCacheSend(sessionId: string) {
  const t = useT();
  const current = useChat(sessionId);
  const [pending, setPending] = useState<{
    sessionId: string;
    thread: string | null;
    warning: CacheWarning;
    send(): void;
  } | null>(null);
  const cancel = (): void => setPending(null);
  const request = (send: () => void): void => {
    const chat = useChats.getState().byId[sessionId];
    const agent = chat?.config?.agent;
    if (chat?.config?.chatId === null) return send();
    const warning = cacheWarning(chat?.usage ?? null, agent, chat?.busy ?? false);
    if (warning) setPending({ sessionId, thread: chat?.config?.chatId ?? null, warning, send });
    else send();
  };
  const valid =
    pending?.sessionId === sessionId && pending.thread === (current.config?.chatId ?? null);
  const dialog = pending && valid && (
    <div className="modal-backdrop" onClick={cancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('chat.cacheWarning.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <ModalTitle title={t('chat.cacheWarning.title')} onClose={cancel} />
        <p className="hint confirm-text">
          {t(
            pending.warning.estimated ? 'chat.cacheWarning.possible' : 'chat.cacheWarning.expired',
          )}
        </p>
        <p className="hint confirm-text">{t('chat.cacheWarning.body')}</p>
        {pending.warning.tokens !== null && (
          <p className="hint">
            {t('chat.cacheWarning.tokens', { n: tokens(pending.warning.tokens) })}
          </p>
        )}
        <button
          type="button"
          disabled={!current.online}
          onClick={() => {
            const live = useChats.getState().byId[sessionId];
            if (!live?.online || (live.config?.chatId ?? null) !== pending.thread) return;
            const action = pending.send;
            cancel();
            action();
          }}
        >
          {t('chat.cacheWarning.send')}
        </button>
        <button type="button" autoFocus onClick={cancel}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
  return { request, dialog };
}
