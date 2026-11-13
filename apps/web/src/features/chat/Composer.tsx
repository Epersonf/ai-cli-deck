import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { useT } from '../../shared/i18n/store';
import { StopIcon } from '../../shared/ui/ToolIcons';
import { ACCEPT } from './attachFiles';
import { Attachments } from './Attachments';
import { MicButton } from './MicButton';
import { OptionsToggle } from './OptionsToggle';
import { useVoice } from '../voice/voiceStore';
import { isLoginCommand } from '../signin/authError';
import { useSignIn } from '../signin/signInStore';
import { useSessions } from '../sessions/sessionsStore';
import { askNotifyPermission } from '../notify/browserNotify';
import { sendChat } from './connection';
import { useAttachments } from './useAttachments';
import { queuedOf, useQueue } from './queueStore';
import { QueueList } from './QueueList';
import { StopQueueDialog } from './StopQueueDialog';

const MAX_HEIGHT = 220;
const coarse = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

interface Props {
  sessionId: string;
  busy: boolean;
  visible: boolean;
}

/** The message box: Enter sends (a phone's Enter is a new line), pictures and PDFs can be pasted or dropped. */
export function Composer({ sessionId, busy, visible }: Props) {
  const t = useT();
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);
  const files = useAttachments();
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (visible && !coarse()) area.current?.focus();
  }, [visible]);
  const empty = text.trim() === '' && files.items.length === 0;
  const queued = useQueue(queuedOf(sessionId));
  const [asking, setAsking] = useState(false);
  const stop = (): void => (queued.length > 0 ? setAsking(true) : interrupt());
  const interrupt = (): void => sendChat(sessionId, { type: 'interrupt' });

  const fit = (): void => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };
  const send = (): void => {
    if (empty) return;
    const provider = useSessions.getState().sessions.find((x) => x.id === sessionId)?.provider;
    if (isLoginCommand(text) && provider !== undefined) {
      useSignIn.getState().open(provider);
      setText('');
      return;
    }
    askNotifyPermission();
    // While an answer is being written the server holds the message in the chat's queue.
    sendChat(sessionId, { type: 'send', text: text.trim(), images: files.items, queue: true });
    setText('');
    files.clear();
    requestAnimationFrame(fit);
  };
  /** Words from the microphone: sent at once in a voice conversation, else added to the box. */
  const heard = (said: string): void => {
    if (useVoice.getState().conversation) {
      return sendChat(sessionId, { type: 'send', text: said, images: [] });
    }
    setText((now) => (now.trim() === '' ? said : `${now.trimEnd()} ${said}`));
    requestAnimationFrame(fit);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || coarse())
      return;
    event.preventDefault();
    send();
  };
  const onPaste = (event: ClipboardEvent): void => {
    const pasted = [...event.clipboardData.files];
    if (pasted.length === 0) return;
    event.preventDefault();
    void files.add(pasted);
  };
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setOver(false);
    void files.add(event.dataTransfer.files);
  };

  return (
    <div
      className={`composer${over ? ' over' : ''}`}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <QueueList sessionId={sessionId} items={queued} />
      {asking && (
        <StopQueueDialog sessionId={sessionId} items={queued} onDone={() => setAsking(false)} />
      )}
      <Attachments items={files.items} tooBig={files.tooBig} onRemove={files.remove} />
      <div className="composer-row">
        <button
          type="button"
          className="tool"
          aria-label={t('chat.attach')}
          title={t('chat.attach')}
          onClick={() => picker.current?.click()}
        >
          +
        </button>
        <OptionsToggle sessionId={sessionId} />
        <input
          ref={picker}
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          onChange={(e) => (void files.add(e.target.files ?? []), (e.target.value = ''))}
        />
        <textarea
          ref={area}
          rows={1}
          value={text}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          enterKeyHint="send"
          onChange={(e) => (setText(e.target.value), fit())}
          onKeyDown={onKey}
          onPaste={onPaste}
        />
        <MicButton onText={heard} />
        {busy && (
          <button
            type="button"
            className="tool stop"
            aria-label={t('chat.stop')}
            title={t('chat.stop')}
            onClick={stop}
          >
            <StopIcon size={22} />
          </button>
        )}
        <button type="button" className="primary send" disabled={empty} onClick={send}>
          {t('chat.send')}
        </button>
      </div>
    </div>
  );
}
