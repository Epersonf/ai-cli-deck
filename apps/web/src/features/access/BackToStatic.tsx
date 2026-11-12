import { MIN_PASSWORD_LENGTH } from '@deck/shared';
import { useState } from 'react';
import { authApi } from '../../shared/api/authApi';
import { useT } from '../../shared/i18n/store';
import { FieldRow } from '../../shared/ui/DialogParts';
import { CodeForm } from './CodeForm';

/** Leaving OTP: the current code proves who asks, and a new static password replaces it. */
export function BackToStatic({ onDone }: { onDone(): void }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  return (
    <CodeForm
      hint={t('otp.toStaticHint')}
      action={t('otp.toStaticNow')}
      ready={password !== '' && again !== ''}
      onSubmit={async (code) => {
        if (password.length < MIN_PASSWORD_LENGTH) {
          throw new Error(t('password.tooShort', { min: MIN_PASSWORD_LENGTH }));
        }
        if (password !== again) throw new Error(t('password.mismatch'));
        await authApi.setMode({ mode: 'static', code, password });
        onDone();
      }}
    >
      <FieldRow label={t('password.new')}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </FieldRow>
      <FieldRow label={t('password.repeat')}>
        <input
          type="password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          autoComplete="new-password"
        />
      </FieldRow>
    </CodeForm>
  );
}
