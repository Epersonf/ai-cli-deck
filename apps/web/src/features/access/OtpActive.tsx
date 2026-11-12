import { useState } from 'react';
import { authApi } from '../../shared/api/authApi';
import { useT } from '../../shared/i18n/store';
import { Disclosure } from '../../shared/ui/DialogParts';
import { toast } from '../../shared/ui/toast';
import { OtpPolicy } from '../auth/OtpPolicy';
import { CodeForm } from './CodeForm';
import { LiveCode } from './LiveCode';
import { SecretView } from './SecretView';
import { useOtpSetup } from './useOtpSetup';

/** OTP is on: the live code, the secret on request, and a new secret (which needs the current code). */
export function OtpActive() {
  const t = useT();
  const { setup, deadline, error, adopt } = useOtpSetup();
  const [rotating, setRotating] = useState(false);
  const [rotations, setRotations] = useState(0);
  return (
    <div className="otp-panel">
      <p className="otp-eyebrow">
        <span className="dot idle" aria-hidden="true" />
        {t('otp.active')}
      </p>
      {error !== null && <p className="notice error">{error}</p>}
      {setup !== null && (
        <>
          <LiveCode code={setup.code} deadline={deadline} />
          <Disclosure key={rotations} summary={t('otp.showSecret')} open={rotations > 0}>
            <SecretView setup={setup} />
          </Disclosure>
        </>
      )}
      {rotating ? (
        <CodeForm
          hint={t('otp.rotateHint')}
          action={t('otp.rotateNow')}
          onCancel={() => setRotating(false)}
          onSubmit={async (code) => {
            adopt(await authApi.rotate(code));
            setRotating(false);
            setRotations((n) => n + 1);
            toast(t('otp.rotated'));
          }}
        />
      ) : (
        <button type="button" onClick={() => setRotating(true)}>
          {t('otp.rotate')}
        </button>
      )}
      <OtpPolicy local />
    </div>
  );
}
