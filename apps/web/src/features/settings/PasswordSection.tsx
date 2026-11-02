import { MIN_PASSWORD_LENGTH, type AuthStatus } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { clearToken, setToken } from '../../shared/api/token';

interface Message {
  text: string;
  error: boolean;
}

export function PasswordSection() {
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
        text: password === null ? 'Password removed.' : 'Password saved.',
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
      return setMessage({ text: `Use at least ${MIN_PASSWORD_LENGTH} characters.`, error: true });
    }
    if (next !== again) return setMessage({ text: 'The two passwords differ.', error: true });
    void apply(next);
  };

  const remove = (): void => {
    if (window.confirm('Remove the password? Anyone who can open this page will get in.')) {
      void apply(null);
    }
  };

  const required = status?.required !== false;
  return (
    <form className="setting" onSubmit={submit}>
      <h3>{required ? 'Change password' : 'Set a password'}</h3>
      {status?.isDefault === true && (
        <p className="notice error">The built-in default password is in use. Please change it.</p>
      )}
      {!required && (
        <p className="hint">
          No password is set. That is fine while the server only listens on this machine.
        </p>
      )}
      {required && (
        <label>
          Current password
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
        New password
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Repeat new password
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
          Save password
        </button>
        {status?.required === true && status.canDisable && (
          <button type="button" onClick={remove} disabled={busy || current === ''}>
            Remove password
          </button>
        )}
      </div>
      {status?.required === true && !status.canDisable && (
        <p className="hint">
          A password is mandatory while the server is reachable from the network.
        </p>
      )}
    </form>
  );
}
