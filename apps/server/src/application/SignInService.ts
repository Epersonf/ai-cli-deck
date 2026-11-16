import type { AuthInfo, SignInFlow, SignInMethod } from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import type { Provider, ProviderRegistry } from '../domain/provider.js';
import type { AuthCli } from '../domain/signin.js';
import { readAuthStatus } from './authStatus.js';
import { LEGACY_LOGIN_KINDS, NO_LEGACY_AUTH } from './loginMethods.js';
import { SignInFlows } from './SignInFlows.js';

const CACHE_MS = 5000;

export interface SignInDeps {
  providers: ProviderRegistry;
  cli?: AuthCli;
  /** The saved profiles: a key is removed by saving an empty one. */
  profiles: { has(id: string): boolean; setSecret(id: string, secret: string): Promise<void> };
  now?(): number;
}

/** Signing in, out and asking who is signed in, for each provider, with the CLI's own commands. */
export class SignInService {
  private readonly flows: SignInFlows;
  private readonly cache = new Map<string, { at: number; info: AuthInfo }>();

  constructor(private readonly d: SignInDeps) {
    this.flows = new SignInFlows(
      d.cli ?? NO_LEGACY_AUTH,
      (id) => this.confirm(id),
      (id) => this.signedIn(id),
    );
  }

  private provider(id: string): Provider {
    const found = this.d.providers.get(id);
    if (!found) throw notFound(`Provider ${id}`);
    return found;
  }

  /** The environment of this provider's own login: its folder, or nothing for the machine's. */
  private env(provider: Provider): Record<string, string> {
    const { login } = provider;
    return login && login.own() ? login.env() : {};
  }

  private async signedIn(id: string): Promise<void> {
    if (this.d.profiles.has(id)) await this.d.profiles.setSecret(id, '');
    this.provider(id).login?.setOwn(true);
    this.cache.delete(id);
  }

  /** After a login ended well: ask with the login's own folder (it is not marked as in use yet). */
  private async confirm(id: string): Promise<boolean> {
    const provider = this.provider(id);
    if (provider.authentication)
      return (await provider.authentication.status(true)).state === 'signed-in';
    const answer = await this.d.cli?.run(provider.agent, 'status', provider.login?.env() ?? {});
    return readAuthStatus(provider.agent, answer ?? null, false).state === 'signed-in';
  }

  readonly current = (id: string): SignInFlow | null => this.flows.current(id);
  readonly cancel = (id: string): void => this.flows.cancel(id);
  readonly input = (id: string, text: string): SignInFlow => this.flows.input(id, text);

  /**
   * Starts a sign-in. `machine` is not a flow: it forgets a saved key and the profile's own login, so the
   * agent uses what this machine's CLI has (for a Claude profile that is the default config folder again).
   */
  async start(id: string, method: SignInMethod): Promise<SignInFlow> {
    const provider = this.provider(id);
    if (method === 'key') throw invalid('A key is saved with PUT /api/profiles/:id/secret');
    if (method === 'machine') {
      await this.forget(id, provider);
      return {
        method,
        state: 'done',
        url: null,
        code: null,
        needsCode: false,
        output: '',
        error: null,
      };
    }
    if (provider.authentication) {
      const auth = provider.authentication;
      const choice = auth.methods.find((item) => item.id === method);
      if (!choice || choice.flow === 'key' || choice.flow === 'machine')
        throw invalid(`${method} does not fit ${provider.label}`);
      return this.flows.start(
        id,
        method,
        method,
        {},
        () => auth.login(method),
        choice.flow === 'device',
      );
    }
    const how = LEGACY_LOGIN_KINDS[method];
    if (!how || how.agent !== provider.agent)
      throw invalid(`${method} does not fit ${provider.label}`);
    const env = provider.login?.env() ?? {};
    return this.flows.start(id, method, how.kind, env);
  }

  private async forget(id: string, provider: Provider): Promise<void> {
    this.flows.cancel(id);
    if (this.d.profiles.has(id)) await this.d.profiles.setSecret(id, '');
    provider.login?.setOwn(false);
    this.cache.delete(id);
  }

  /** Signs out of this provider's own login and forgets its key. The machine's login is only touched for a built-in. */
  async logout(id: string): Promise<void> {
    const provider = this.provider(id);
    this.flows.cancel(id);
    const isProfile = this.d.profiles.has(id);
    if (!isProfile || provider.login?.own()) {
      if (provider.authentication) await provider.authentication.logout();
      else await this.d.cli?.run(provider.agent, 'logout', provider.login?.env() ?? {});
    }
    await this.forget(id, provider);
  }

  /** Who the provider is signed in as: a saved key, else the CLI's own answer (a few seconds of memory). */
  async auth(id: string, fresh = false): Promise<AuthInfo> {
    const provider = this.provider(id);
    const key = provider.keyState?.() ?? 'none';
    if (key === 'set') return { state: 'signed-in', via: 'API key', account: null };
    if (key === 'missing') return { state: 'signed-out', via: null, account: null };
    const hit = this.cache.get(id);
    const now = (this.d.now ?? Date.now)();
    if (!fresh && hit && now - hit.at < CACHE_MS) return hit.info;
    const env = this.env(provider);
    const info = provider.authentication
      ? await provider.authentication
          .status()
          .catch(() => ({ state: 'unknown' as const, via: null, account: null }))
      : readAuthStatus(
          provider.agent,
          await (this.d.cli?.run(provider.agent, 'status', env) ?? Promise.resolve(null)).catch(
            () => null,
          ),
          Object.keys(env).length === 0,
        );
    this.cache.set(id, { at: now, info });
    return info;
  }
}
