import type { AuthStatus } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { clearToken, setToken } from '../../shared/api/token';

const MIN_LENGTH = 4;

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (): void =>
    void api
      .authStatus()
      .then(setStatus)
      .catch(() => undefined);
  useEffect(load, []);

  const apply = async (newPassword: string | null): Promise<void> => {
    setBusy(true);
    try {
      const { token } = await api.changePassword(status?.required ? current : null, newPassword);
      if (token === null) clearToken();
      else setToken(token);
      setCurrent('');
      setNext('');
      setAgain('');
      setMessage({
        text: newPassword === null ? 'Password removed.' : 'Password saved.',
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
    if (next.length < MIN_LENGTH)
      return setMessage({ text: `Use at least ${MIN_LENGTH} characters.`, error: true });
    if (next !== again) return setMessage({ text: 'The two passwords differ.', error: true });
    void apply(next);
  };

  const remove = (): void => {
    if (window.confirm('Remove the password? Anyone who can open this page will get in.'))
      void apply(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{status?.required === false ? 'Set a password' : 'Change password'}</h2>
        {status?.isDefault === true && (
          <p className="notice error">The built-in default password is in use. Please change it.</p>
        )}
        {status?.required === false && (
          <p className="hint">
            No password is set. That is fine while the server only listens on this machine.
          </p>
        )}
        {status?.required !== false && (
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
            Save
          </button>
          {status?.required === true && status.canDisable && (
            <button type="button" onClick={remove} disabled={busy || current === ''}>
              Remove password
            </button>
          )}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {status?.required === true && !status.canDisable && (
          <p className="hint">
            A password is mandatory while the server is reachable from the network.
          </p>
        )}
      </form>
    </div>
  );
}
