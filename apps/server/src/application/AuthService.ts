import {
  DEFAULT_PASSWORD,
  MIN_PASSWORD_LENGTH,
  type AuthMode,
  type AuthStorePort,
  type PasswordHash,
  type PasswordHasherPort,
  type StoredPassword,
} from '../domain/auth.js';
import { WrongPasswordError, forbidden, invalid } from '../domain/errors.js';
import { safeEqual } from '../domain/safeEqual.js';
import { applyModes, type AuthChange, type SavedModes } from './authChange.js';
import { chooseAuthSource, type AuthSource } from './authSource.js';

export { chooseAuthSource, type AuthSource };

export interface AuthDeps {
  store: AuthStorePort;
  hasher: PasswordHasherPort;
  newToken(): string;
  loopback: boolean;
  envPassword: string | null;
}

export class AuthService {
  private constructor(
    private readonly deps: AuthDeps,
    private hash: PasswordHash | null,
    private token: string,
    private source: AuthSource,
    private stored: StoredPassword | null,
    private saved: SavedModes,
  ) {}

  static async create(deps: AuthDeps): Promise<AuthService> {
    const file = await deps.store.load();
    const stored = file?.password ?? null;
    const source = chooseAuthSource({
      loopback: deps.loopback,
      stored,
      envPassword: deps.envPassword,
    });
    const plain =
      source === 'env' ? deps.envPassword : source === 'default' ? DEFAULT_PASSWORD : null;
    const hash =
      stored?.kind === 'password' && source === 'stored'
        ? stored
        : plain && deps.hasher.hash(plain);
    const kept = {
      mode: file?.mode ?? 'static',
      otp: file?.otp ?? null,
      pendingOtp: file?.pendingOtp ?? null,
    } as const;
    const service = new AuthService(
      deps,
      hash || null,
      file?.token ?? deps.newToken(),
      source,
      stored,
      kept,
    );
    if (!file) await service.persist();
    return service;
  }

  get mode(): AuthMode {
    return this.saved.mode;
  }
  /** Whether a login is needed at all (OTP mode: from every client except this machine, see `requiredFor`). */
  get required(): boolean {
    return this.mode === 'otp' || this.hash !== null;
  }
  /** Whether this client must sign in: in OTP mode the machine itself is exempt. */
  requiredFor(loopbackClient: boolean): boolean {
    return this.mode === 'otp' ? !loopbackClient : this.required;
  }
  get isDefault(): boolean {
    return this.mode === 'static' && this.source === 'default';
  }
  get canDisable(): boolean {
    return this.deps.loopback;
  }
  /** Token handed out after a correct login; null while authentication is off. */
  get accessToken(): string | null {
    return this.required ? this.token : null;
  }
  /** The secrets: the one in use (OTP mode) and the one waiting for its first proven code. */
  get otpSecrets(): { active: string | null; pending: string | null } {
    return {
      active: this.saved.otp?.secret ?? null,
      pending: this.saved.pendingOtp?.secret ?? null,
    };
  }

  verifyPassword(password: string): boolean {
    return (
      this.mode === 'static' && this.hash !== null && this.deps.hasher.verify(password, this.hash)
    );
  }

  isValidToken(provided: string | undefined, loopbackClient = false): boolean {
    if (!this.requiredFor(loopbackClient)) return true;
    return provided !== undefined && safeEqual(this.token, provided);
  }

  /** Sets, changes (`next` set) or removes (`next` null) the password. Returns the new token. */
  async change(current: string | null, next: string | null): Promise<string | null> {
    if (this.mode === 'otp') throw forbidden('Switch to password mode first');
    if (this.required && (current === null || !this.verifyPassword(current))) {
      throw new WrongPasswordError();
    }
    if (next === null && !this.deps.loopback) {
      throw forbidden('A password is mandatory while the server is reachable from the network');
    }
    if (next !== null && next.length < MIN_PASSWORD_LENGTH) {
      throw invalid(`The password needs at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    this.hash = next === null ? null : this.deps.hasher.hash(next);
    this.stored = this.hash === null ? { kind: 'none' } : { kind: 'password', ...this.hash };
    this.source = this.hash === null ? 'none' : 'stored';
    this.token = this.deps.newToken();
    await this.persist();
    return this.accessToken;
  }

  /** Applies a change of mode or secrets and saves it; returns the access token to use from now on. */
  async update(change: AuthChange): Promise<string | null> {
    this.saved = applyModes(this.saved, change);
    if (change.password !== undefined) {
      this.hash = this.deps.hasher.hash(change.password);
      this.stored = { kind: 'password', ...this.hash };
      this.source = 'stored';
    }
    if (change.newToken) this.token = this.deps.newToken();
    await this.persist();
    return this.accessToken;
  }

  private persist(): Promise<void> {
    return this.deps.store.save({ password: this.stored, token: this.token, ...this.saved });
  }
}
