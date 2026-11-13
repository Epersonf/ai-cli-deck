import { useRef, type ClipboardEvent, type KeyboardEvent, type RefObject } from 'react';
import { useT } from '../../shared/i18n/store';
import { StopIcon } from '../../shared/ui/ToolIcons';
import { ACCEPT } from './attachFiles';
import { MicButton } from './MicButton';
import { OptionsToggle } from './OptionsToggle';

interface Props {
  sessionId: string;
  text: string;
  empty: boolean;
  busy: boolean;
  area: RefObject<HTMLTextAreaElement | null>;
  onText(value: string, caret: number): void;
  onCaret(caret: number): void;
  onKey(event: KeyboardEvent): void;
  onPaste(event: ClipboardEvent): void;
  onFiles(files: Iterable<File>): void;
  onHeard(said: string): void;
  onStop(): void;
  onSend(): void;
}

/** The row of the message box: attach, options, the text, the microphone, stop and send. */
export function ComposerRow(p: Props) {
  const t = useT();
  const picker = useRef<HTMLInputElement>(null);
  return (
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
      <input
        ref={picker}
        type="file"
        hidden
        multiple
        accept={ACCEPT}
        onChange={(e) => (p.onFiles(e.target.files ?? []), (e.target.value = ''))}
      />
      <OptionsToggle sessionId={p.sessionId} />
      <textarea
        ref={p.area}
        rows={1}
        value={p.text}
        placeholder={t('chat.placeholder')}
        aria-label={t('chat.placeholder')}
        enterKeyHint="send"
        onChange={(e) => p.onText(e.target.value, e.target.selectionStart)}
        onSelect={(e) => p.onCaret(e.currentTarget.selectionStart)}
        onKeyDown={p.onKey}
        onPaste={p.onPaste}
      />
      <MicButton onText={p.onHeard} />
      {p.busy && (
        <button
          type="button"
          className="tool stop"
          aria-label={t('chat.stop')}
          title={t('chat.stop')}
          onClick={p.onStop}
        >
          <StopIcon size={22} />
        </button>
      )}
      <button type="button" className="primary send" disabled={p.empty} onClick={p.onSend}>
        {t('chat.send')}
      </button>
    </div>
  );
}
