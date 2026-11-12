import { useEffect, useState, type FormEvent } from 'react';
import { authApi } from '../../shared/api/authApi';
import { setToken } from '../../shared/api/token';
import { useT } from '../../shared/i18n/store';
import { Gear } from '../../shared/ui/Gear';
import { OtpLogin } from './OtpLogin';

type Mode = 'static' | 'otp' | null;

/** The lock screen: the static passphrase, or the six boxes of a one-time code, whichever the deck uses. */
export function LoginScreen({ onDone }: { onDone(): void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void authApi
      .status()
      .then((status) => setMode(status.mode))
      .catch(() => setMode('static'));
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await authApi.login({ password });
      if (token !== null) setToken(token);
      onDone();
    } catch (e) {
      setError(
        e instanceof Error && !(e instanceof TypeError) ? e.message : t('login.unreachable'),
      );
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="modal login-card">
        <Gear size={64} teeth={12} className="spin" />
        <h1>Deck</h1>
        {mode === 'otp' && <OtpLogin onDone={onDone} />}
        {mode === 'static' && (
          <form onSubmit={(event) => void submit(event)}>
            <p className="hint">{t('login.hint')}</p>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('login.placeholder')}
              autoComplete="current-password"
              autoFocus
              required
            />
            {error !== null && <p className="notice error">{error}</p>}
            <button type="submit" className="primary" disabled={busy}>
              {t('login.unlock')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
