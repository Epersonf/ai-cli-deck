import { useState, type FormEvent, type ReactNode } from 'react';
import { useT } from '../../shared/i18n/store';
import { DigitBoxes } from '../auth/DigitBoxes';

interface Props {
  /** A short line over the boxes. */
  hint?: string;
  /** The primary button. */
  action: string;
  /** Extra fields between the boxes and the buttons. */
  children?: ReactNode;
  /** False keeps the button off (e.g. the extra fields are still empty). */
  ready?: boolean;
  /** Throw to show the message under the boxes. */
  onSubmit(code: string): Promise<void>;
  onCancel?: () => void;
}

/** Six digit boxes plus a primary button: the proof-of-code step of every OTP change. Server errors show inline. */
export function CodeForm({ hint, action, children, ready = true, onSubmit, onCancel }: Props) {
  const t = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const can = code.length === 6 && ready && !busy;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!can) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(code);
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.unreachable'));
    }
    setBusy(false);
  };

  return (
    <form className="code-form" onSubmit={(event) => void submit(event)}>
      {hint !== undefined && <p className="hint">{hint}</p>}
      <DigitBoxes value={code} onChange={setCode} disabled={busy} label={t('otp.digit')} />
      {children}
      {error !== null && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        {onCancel && (
          <button type="button" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" className="primary" disabled={!can}>
          {action}
        </button>
      </div>
    </form>
  );
}
