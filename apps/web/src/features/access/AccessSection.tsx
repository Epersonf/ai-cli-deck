import type { AuthStatus } from '@deck/shared';
import { useEffect, useState } from 'react';
import { authApi } from '../../shared/api/authApi';
import { useT } from '../../shared/i18n/store';
import { PasswordSection } from '../settings/PasswordSection';
import { BackToStatic } from './BackToStatic';
import { ModePlates, type AccessView } from './ModePlates';
import { OtpActive } from './OtpActive';
import { OtpPending } from './OtpPending';

/** How this deck is unlocked: a static password, or a one-time code from an authenticator app. */
export function AccessSection() {
  const t = useT();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [view, setView] = useState<AccessView | null>(null);
  const load = (): void =>
    void authApi
      .status()
      .then((next) => (setStatus(next), setView((now) => now ?? next.mode)))
      .catch(() => undefined);
  useEffect(load, []);

  if (status === null || view === null) return <p className="hint">{t('common.loading')}</p>;
  return (
    <div className="access">
      <ModePlates value={view} active={status.mode} onChange={setView} />
      {view === 'static' && status.mode === 'static' && <PasswordSection />}
      {view === 'static' && status.mode === 'otp' && <BackToStatic onDone={load} />}
      {view === 'otp' && status.mode === 'static' && <OtpPending onActivated={load} />}
      {view === 'otp' && status.mode === 'otp' && <OtpActive />}
    </div>
  );
}
