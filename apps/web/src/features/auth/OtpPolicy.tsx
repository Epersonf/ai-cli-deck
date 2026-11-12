import { OTP } from '@deck/shared';
import { useT } from '../../shared/i18n/store';

/** The small meta list: what the code is and what happens after wrong tries. */
export function OtpPolicy({ local = false }: { local?: boolean }) {
  const t = useT();
  return (
    <ul className="otp-meta">
      <li>{t('otp.meta.step', { s: OTP.stepSeconds })}</li>
      <li>{t('otp.meta.tries', { n: OTP.triesPerRound })}</li>
      <li>{t('otp.meta.lock', { list: OTP.lockMinutes.join(', ') })}</li>
      <li>{t('otp.meta.forget', { m: OTP.forgetMinutes })}</li>
      {local && <li>{t('otp.meta.local')}</li>}
    </ul>
  );
}
