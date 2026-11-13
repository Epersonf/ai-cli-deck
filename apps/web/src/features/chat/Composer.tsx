import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { Attachments } from './Attachments';
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
import { SuggestList } from './SuggestList';
import { useCompletion } from './useCompletion';
import { useRunCommand } from './useRunCommand';
import { ComposerRow } from './ComposerRow';
import { useDraftText } from './useDraftText';

const MAX_HEIGHT = 220;
const coarse = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

interface Props {
  sessionId: string;
  busy: boolean;
  visible: boolean;
}

/** The message box: Enter sends (a phone's Enter is a new line), pictures and PDFs can be pasted or dropped. */
export function Composer({ sessionId, busy, visible }: Props) {
  const [text, setText] = useDraftText(sessionId);
  const [over, setOver] = useState(false);
  const files = useAttachments();
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (visible && !coarse()) area.current?.focus();
  }, [visible]);
  const empty = text.trim() === '' && files.items.length === 0;
  const queued = useQueue(queuedOf(sessionId));
  const [asking, setAsking] = useState(false);
  const interrupt = (): void => sendChat(sessionId, { type: 'interrupt' });
  const stop = (): void => (queued.length > 0 ? setAsking(true) : interrupt());
  const runCommand = useRunCommand(sessionId);

  const fit = (): void => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };
  const {
    suggest,
    pick,
    onKey: completionKey,
    setCaret,
  } = useCompletion(sessionId, text, setText, area, fit);
  const send = (): void => {
    if (empty) return;
    if (runCommand(text)) {
      setText('');
      requestAnimationFrame(fit);
      return;
    }
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
    if (completionKey(event)) return;
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
      {suggest.open && <SuggestList items={suggest.items} index={suggest.index} onPick={pick} />}
      <QueueList sessionId={sessionId} items={queued} />
      {asking && (
        <StopQueueDialog sessionId={sessionId} items={queued} onDone={() => setAsking(false)} />
      )}
      <Attachments items={files.items} tooBig={files.tooBig} onRemove={files.remove} />
      <ComposerRow
        sessionId={sessionId}
        text={text}
        empty={empty}
        busy={busy}
        area={area}
        onText={(value, at) => (setText(value), setCaret(at), fit())}
        onCaret={setCaret}
        onKey={onKey}
        onPaste={onPaste}
        onFiles={(list) => void files.add(list)}
        onHeard={heard}
        onStop={stop}
        onSend={send}
      />
    </div>
  );
}
