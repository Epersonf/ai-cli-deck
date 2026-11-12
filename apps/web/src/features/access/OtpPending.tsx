import { authApi } from '../../shared/api/authApi';
import { useT } from '../../shared/i18n/store';
import { OtpPolicy } from '../auth/OtpPolicy';
import { CodeForm } from './CodeForm';
import { LiveCode } from './LiveCode';
import { SecretView } from './SecretView';
import { useOtpSetup } from './useOtpSetup';

/** OTP is chosen but not on yet: scan the secret, then prove the app works with a code to switch it on. */
export function OtpPending({ onActivated }: { onActivated(): void }) {
  const t = useT();
  const { setup, deadline, error } = useOtpSetup();
  return (
    <div className="otp-panel">
      <p className="hint">{t('otp.setup.intro')}</p>
      {error !== null && <p className="notice error">{error}</p>}
      {setup !== null && (
        <>
          <SecretView setup={setup} />
          <LiveCode code={setup.code} deadline={deadline} />
        </>
      )}
      <CodeForm
        hint={t('otp.confirm')}
        action={t('otp.activate')}
        ready={setup !== null}
        onSubmit={async (code) => {
          await authApi.setMode({ mode: 'otp', code });
          onActivated();
        }}
      />
      <OtpPolicy local />
    </div>
  );
}
