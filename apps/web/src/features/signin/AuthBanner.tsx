import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { useSignIn } from './signInStore';

interface Props {
  provider: string;
  /** The text of the last message of the person, so it can be sent again after signing in. */
  lastText: string | null;
  onResend(text: string): void;
}

/** Over a chat that cannot answer for lack of a login or key: one button opens the sign-in dialog. */
export function AuthBanner({ provider, lastText, onResend }: Props) {
  const t = useT();
  const [signedIn, setSignedIn] = useState(false);
  return (
    <div className="key-banner" role="alert">
      <p>{signedIn ? t('signin.done') : t('signin.banner')}</p>
      <div className="row">
        {signedIn ? (
          lastText !== null && (
            <button type="button" className="primary" onClick={() => onResend(lastText)}>
              {t('signin.resend')}
            </button>
          )
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => useSignIn.getState().open(provider, () => setSignedIn(true))}
          >
            {t('signin.open')}
          </button>
        )}
      </div>
    </div>
  );
}
