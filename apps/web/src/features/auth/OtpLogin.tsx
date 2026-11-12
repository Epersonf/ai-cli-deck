import { useEffect, useState } from 'react';
import { authApi, loginFailure, type LoginFailure } from '../../shared/api/authApi';
import { setToken } from '../../shared/api/token';
import { useT } from '../../shared/i18n/store';
import { CodeBar } from './CodeBar';
import { DigitBoxes } from './DigitBoxes';
import { formatClock, secondsUntil, stepFraction } from './otpClock';
import { OtpPolicy } from './OtpPolicy';
import { useNow } from './useNow';

/** Signing in with the six-digit code: auto-submits at the sixth digit; locks (with a countdown) after wrong rounds. */
export function OtpLogin({ onDone }: { onDone(): void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [round, setRound] = useState(0);
  const [failure, setFailure] = useState<LoginFailure | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = lockedUntil > 0;
  const now = useNow(250);
  const left = secondsUntil(lockedUntil, now);
  useEffect(() => {
    if (!locked || left > 0) return;
    setLockedUntil(0);
    setFailure(null);
    setRound((r) => r + 1);
  }, [locked, left]);

  const submit = async (value: string): Promise<void> => {
    setBusy(true);
    setFailure(null);
    try {
      const { token } = await authApi.login({ code: value });
      if (token !== null) setToken(token);
      onDone();
      return;
    } catch (e) {
      const next = loginFailure(e);
      setFailure(next);
      if (next.kind === 'locked') setLockedUntil(Date.now() + next.wait * 1000);
    }
    setCode('');
    setRound((r) => r + 1);
    setBusy(false);
  };

  const message =
    failure === null
      ? null
      : failure.kind === 'wrong'
        ? t(failure.triesLeft === 1 ? 'otp.wrongOne' : 'otp.wrong', { n: failure.triesLeft })
        : failure.kind === 'locked'
          ? t('otp.locked', { time: formatClock(left) })
          : failure.kind === 'other'
            ? failure.message
            : t('login.unreachable');
  return (
    <div className="otp-login">
      <p className={`otp-eyebrow${locked ? ' locked' : ''}`}>
        <span className={`dot${locked ? '' : ' idle'}`} aria-hidden="true" />
        {locked ? t('otp.lockedTitle') : t('otp.title')}
      </p>
      <p className="hint">{t('otp.hint')}</p>
      <DigitBoxes
        key={round}
        value={code}
        onChange={setCode}
        onComplete={(value) => void submit(value)}
        disabled={busy || locked}
        invalid={failure?.kind === 'wrong' || locked}
        autoFocus
        label={t('otp.digit')}
      />
      <CodeBar fraction={stepFraction(now)} label={t('otp.step')} />
      <p className={`otp-message${message === null ? ' empty' : ''}`} role="alert">
        {message ?? ' '}
      </p>
      <OtpPolicy />
    </div>
  );
}
