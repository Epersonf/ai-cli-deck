import type { AuthInfo, SignInMethod } from '@deck/shared';
import { useEffect, useState } from 'react';
import { signinApi } from '../../shared/api/signinApi';
import { useLocale, useT } from '../../shared/i18n/store';
import { ChoiceSheet } from '../../shared/ui/ChoiceSheet';
import { DialogActions, Disclosure } from '../../shared/ui/DialogParts';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { useProfiles } from '../sessions/profilesStore';
import { FlowStepper } from './FlowStepper';
import { ProviderInstall } from './ProviderInstall';
import { KeyForm } from './KeyForm';
import { methodsFor } from './methods';
import { useSignIn } from './signInStore';
import { useLoginFlow } from './useLoginFlow';

/** The sign-in dialog of one provider: who is signed in, the way to sign in, and only that way's steps. */
export function SignInHost() {
  const provider = useSignIn((s) => s.provider);
  return provider === null ? null : <SignInDialog key={provider} provider={provider} />;
}

function SignInDialog({ provider }: { provider: string }) {
  const t = useT();
  const close = useSignIn((s) => s.close);
  const info = useProfiles((s) => s.providers.find((p) => p.id === provider));
  const locale = useLocale((state) => state.locale);
  const methods = methodsFor(
    info?.agent ?? 'claude',
    info?.signIn === 'key',
    info?.authMethods,
    locale,
  );
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [selected, setMethod] = useState<SignInMethod>(methods[0]?.id ?? 'key');
  const method = methods.some((choice) => choice.id === selected)
    ? selected
    : (methods[0]?.id ?? 'key');
  const [saved, setSaved] = useState(false);

  const refresh = (): void => {
    signinApi.auth(provider).then(setAuth, () => setAuth(null));
    void useProfiles.getState().refresh();
  };
  useEffect(refresh, [provider]);
  const succeeded = (): void => {
    refresh();
    setSaved(true);
    useSignIn.getState().onSuccess?.();
  };
  const login = useLoginFlow(provider, succeeded);
  const current = methods.find((m) => m.id === method) ?? methods[0];
  const flow = login.flow;
  const problem = flow?.state === 'failed' || flow?.state === 'cancelled' ? flow : null;
  const lamp =
    auth?.state === 'signed-in' ? 'on' : auth?.state === 'signed-out' ? 'off' : 'unknown';
  const status =
    auth?.state === 'signed-in'
      ? t('signin.signedIn', { via: auth.via ?? '' }) +
        (auth.account === null ? '' : ` (${auth.account})`)
      : auth?.state === 'signed-out'
        ? t('signin.signedOut')
        : t('signin.unknown');
  const choose = (id: string): void => {
    login.reset();
    setSaved(false);
    setMethod(methods.find((m) => m.id === id)?.id ?? method);
  };
  const start = (): void => void login.start(method);

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal signin" onClick={(e) => e.stopPropagation()}>
        <ModalTitle title={t('signin.title')} onClose={close} />
        <div className="signin-status">
          <span className={`lamp ${lamp}`} aria-hidden />
          <span className="signin-status-text">{status}</span>
          {auth?.state === 'signed-in' && (
            <button
              type="button"
              className="ghost"
              onClick={() => void signinApi.logout(provider).then(refresh, () => undefined)}
            >
              {t('signin.signOut')}
            </button>
          )}
        </div>
        <ChoiceSheet
          label={t('signin.method')}
          value={method}
          choices={methods.map((m) => ({
            id: m.id,
            title: m.label ?? t(m.title),
            subtitle: m.description ?? t(m.subtitle),
          }))}
          onChange={choose}
        />
        {info?.status === 'missing' ? (
          <ProviderInstall info={info} onInstalled={refresh} />
        ) : saved ? (
          <>
            <p className="notice signin-ok">{t('signin.done')}</p>
            <DialogActions>
              <button type="button" className="primary" onClick={close}>
                {t('common.close')}
              </button>
            </DialogActions>
          </>
        ) : (
          <>
            {problem && (
              <div className="notice error">
                {problem.state === 'cancelled'
                  ? t('signin.cancelled')
                  : (problem.error ?? t('signin.failed'))}
                {problem.output !== '' && (
                  <Disclosure summary={t('signin.details')}>
                    <pre className="signin-output">{problem.output}</pre>
                  </Disclosure>
                )}
              </div>
            )}
            {current && method === 'key' && (
              <KeyForm provider={provider} method={current} onSaved={succeeded} />
            )}
            {method === 'machine' && (
              <button type="button" className="primary" disabled={login.busy} onClick={start}>
                {t('signin.useMachine')}
              </button>
            )}
            {method !== 'key' && method !== 'machine' && (
              <FlowStepper
                key={method}
                method={method}
                flowType={current?.flow}
                flow={flow}
                busy={login.busy}
                onStart={start}
                onCode={(text) => void login.sendCode(text)}
                onCancel={() => void login.cancel()}
                onRestart={() => void login.cancel().then(() => (login.reset(), start()))}
              />
            )}
            {login.error !== null && <p className="notice error">{login.error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
