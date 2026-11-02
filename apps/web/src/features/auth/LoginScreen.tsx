import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { setToken } from '../../shared/api/token';
import { Gear } from '../../shared/ui/Gear';

export function LoginScreen({ onDone }: { onDone(): void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.login(password);
      if (token !== null) setToken(token);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server');
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="modal login-card" onSubmit={(event) => void submit(event)}>
        <Gear size={64} teeth={12} className="spin" />
        <h1>Deck</h1>
        <p className="hint">Speak the passphrase to enter the workshop.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Passphrase"
          autoComplete="current-password"
          autoFocus
          required
        />
        {error !== null && <p className="notice error">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          Unlock
        </button>
      </form>
    </div>
  );
}
