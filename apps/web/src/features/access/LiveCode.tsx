import { OTP } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { CodeBar } from '../auth/CodeBar';
import { secondsUntil } from '../auth/otpClock';
import { useNow } from '../auth/useNow';
import { formatCode } from './otpFormat';

/** The code right now, with the thin bar draining to the next one. */
export function LiveCode({ code, deadline }: { code: string; deadline: number }) {
  const t = useT();
  const now = useNow(250);
  return (
    <div className="live-code">
      <div className="live-head">
        <small>{t('otp.liveCode')}</small>
        <small>{t('otp.changesIn', { s: secondsUntil(deadline, now) })}</small>
      </div>
      <output className="live-digits">{formatCode(code)}</output>
      <CodeBar fraction={(deadline - now) / (OTP.stepSeconds * 1000)} label={t('otp.step')} />
    </div>
  );
}
