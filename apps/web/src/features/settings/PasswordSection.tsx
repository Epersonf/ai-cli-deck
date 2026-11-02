import { MIN_PASSWORD_LENGTH, type AuthStatus } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { clearToken, setToken } from '../../shared/api/token';
import { useT } from '../../shared/i18n/store';

interface Message {
  text: string;
  error: boolean;
}

export function PasswordSection() {
  const t = useT();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (): void =>
    void api
      .authStatus()
      .then(setStatus)
      .catch(() => undefined);
  useEffect(load, []);

  const apply = async (password: string | null): Promise<void> => {
    setBusy(true);
    try {
      const { token } = await api.changePassword(status?.required ? current : null, password);
      if (token === null) clearToken();
      else setToken(token);
      setCurrent('');
      setNext('');
      setAgain('');
      setMessage({
        text: password === null ? t('password.removed') : t('password.saved'),
        error: false,
      });
      load();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'failed', error: true });
    }
    setBusy(false);
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (next.length < MIN_PASSWORD_LENGTH) {
      return setMessage({
        text: t('password.tooShort', { min: MIN_PASSWORD_LENGTH }),
        error: true,
      });
    }
    if (next !== again) return setMessage({ text: t('password.mismatch'), error: true });
    void apply(next);
  };

  const remove = (): void => {
    if (window.confirm(t('password.removeConfirm'))) {
      void apply(null);
    }
  };

  const required = status?.required !== false;
  return (
    <form className="password-form" onSubmit={submit}>
      {status?.isDefault === true && <p className="notice error">{t('password.defaultInUse')}</p>}
      {!required && <p className="hint">{t('password.none')}</p>}
      {required && (
        <label>
          {t('password.current')}
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
      )}
      <label>
        {t('password.new')}
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        {t('password.repeat')}
        <input
          type="password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      {message !== null && (
        <p className={`notice${message.error ? ' error' : ''}`}>{message.text}</p>
      )}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {t('password.save')}
        </button>
        {status?.required === true && status.canDisable && (
          <button type="button" onClick={remove} disabled={busy || current === ''}>
            {t('password.remove')}
          </button>
        )}
      </div>
      {status?.required === true && !status.canDisable && (
        <p className="hint">{t('password.mandatory')}</p>
      )}
    </form>
  );
}
