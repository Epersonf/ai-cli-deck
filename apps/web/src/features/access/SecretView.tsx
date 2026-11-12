import type { OtpSetup } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { toast } from '../../shared/ui/toast';
import { formatSecret } from './otpFormat';
import { QrCode } from './QrCode';

/** The QR code and the secret in groups, with a Copy button. */
export function SecretView({ setup }: { setup: OtpSetup }) {
  const t = useT();
  const copy = (): void => {
    void navigator.clipboard?.writeText(setup.secret).then(() => toast(t('files.copied')));
  };
  return (
    <div className="secret-view">
      <QrCode text={setup.uri} label={t('otp.qr')} />
      <div className="secret-side">
        <small>{t('otp.secret')}</small>
        <code>{formatSecret(setup.secret)}</code>
        <button type="button" onClick={copy}>
          {t('otp.copy')}
        </button>
      </div>
    </div>
  );
}
