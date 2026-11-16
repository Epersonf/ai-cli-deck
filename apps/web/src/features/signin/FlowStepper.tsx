import type { SignInFlow, SignInMethod } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { InlineField } from '../../shared/ui/DialogParts';
import { LoginStartButton } from './LoginStartButton';
import { Stepper, type Step } from '../../shared/ui/Stepper';
import { toast } from '../../shared/ui/toast';
import { copyText } from '../settings/templateFile';

interface Props {
  method: SignInMethod;
  flowType?: 'code' | 'device' | 'key' | 'machine' | undefined;
  /** The login the server runs; null before it starts. */
  flow: SignInFlow | null;
  busy: boolean;
  onStart(): void;
  onCode(text: string): void;
  onCancel(): void;
  onRestart(): void;
}

const WRONG_CODE_AFTER_MS = 20_000;

/** The steps of one login: only the current one is open, with one clear action; the rest is quiet. */
export function FlowStepper({
  method,
  flowType,
  flow,
  busy,
  onStart,
  onCode,
  onCancel,
  onRestart,
}: Props) {
  const t = useT();
  const [code, setCode] = useState('');
  const [opened, setOpened] = useState(false);
  const [slow, setSlow] = useState(false);
  const device = flowType === 'device' || method === 'codex-chatgpt';
  const running = flow?.state === 'running';
  const waiting = running && opened;
  useEffect(() => {
    setSlow(false);
    if (!waiting) return;
    const timer = window.setTimeout(() => setSlow(true), WRONG_CODE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const copy = (text: string): void =>
    void copyText(text)
      .then(() => toast(t('files.copied')))
      .catch(() => undefined);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onCode(code.trim());
    setCode('');
  };

  const url = flow?.url ?? null;
  const deviceCode = flow?.code ?? null;
  const start: Step = {
    id: 'start',
    title: t('signin.step.start'),
    body: <LoginStartButton busy={busy} running={running} onStart={onStart} />,
  };
  const open: Step = {
    id: 'open',
    title: device ? t('signin.step.type') : t('signin.step.open'),
    body: (
      <>
        <p className="hint">
          {t(
            device
              ? 'signin.step.open.codex'
              : method.startsWith('claude-')
                ? 'signin.step.open.claude'
                : 'signin.step.open.plugin',
          )}
        </p>
        {device && deviceCode !== null && (
          <div className="signin-code">
            <strong>{deviceCode}</strong>
            <button type="button" className="ghost" onClick={() => copy(deviceCode)}>
              {t('signin.copyCode')}
            </button>
          </div>
        )}
        {url !== null && (
          <a
            className="btn primary"
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpened(true)}
          >
            {t('signin.openPage')}
          </a>
        )}
        {url !== null && (
          <button type="button" className="ghost" onClick={() => copy(url)}>
            {t('signin.copyLink')}
          </button>
        )}
        {device && opened && <p className="hint">{t('signin.waiting')}</p>}
      </>
    ),
  };
  const paste: Step = {
    id: 'paste',
    title: t('signin.step.paste'),
    body: (
      <form onSubmit={submit}>
        <InlineField>
          <input
            value={code}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('signin.pasteCode')}
            aria-label={t('signin.pasteCode')}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="primary" disabled={busy || code.trim() === ''}>
            {t('signin.submitCode')}
          </button>
        </InlineField>
        {slow && <p className="hint">{t('signin.wrongCode')}</p>}
      </form>
    ),
  };

  const steps = device ? [start, open] : [start, open, paste];
  const current = !running ? 0 : device || !opened ? 1 : 2;
  return (
    <>
      <Stepper steps={steps} current={current} />
      {running && (
        <div className="signin-quiet">
          <button type="button" className="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          {slow && (
            <button type="button" className="ghost" onClick={onRestart}>
              {t('signin.restart')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
