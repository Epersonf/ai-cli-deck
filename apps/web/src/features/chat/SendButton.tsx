import { useT } from '../../shared/i18n/store';
import { StopIcon } from '../../shared/ui/ToolIcons';

/** What the main button does: stop the answer while the agent works and nothing is typed, else send. */
export const mainAction = (busy: boolean, empty: boolean): 'send' | 'stop' =>
  busy && empty ? 'stop' : 'send';

interface Props {
  busy: boolean;
  /** Nothing to send: no text and no attachments. */
  empty: boolean;
  onSend(): void;
  onStop(): void;
}

/** One button for both jobs: Send, which turns into Stop while the agent answers and the box is empty. */
export function SendButton({ busy, empty, onSend, onStop }: Props) {
  const t = useT();
  if (mainAction(busy, empty) === 'stop') {
    return (
      <button
        type="button"
        className="primary send stop"
        aria-label={t('chat.stop')}
        title={t('chat.stop')}
        onClick={onStop}
      >
        <StopIcon size={20} />
      </button>
    );
  }
  return (
    <button type="button" className="primary send" disabled={empty} onClick={onSend}>
      {t('chat.send')}
    </button>
  );
}
