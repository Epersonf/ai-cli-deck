import {
  DEFAULT_PASSWORD,
  MIN_PASSWORD_LENGTH,
  type AuthStorePort,
  type PasswordHash,
  type PasswordHasherPort,
  type StoredPassword,
} from '../domain/auth.js';
import { WrongPasswordError, forbidden, invalid } from '../domain/errors.js';
import { safeEqual } from '../domain/safeEqual.js';

export type AuthSource = 'stored' | 'env' | 'default' | 'none';

/**
 * Where the active password comes from. A password changed in the app wins; "no password" is only
 * honoured on loopback; otherwise env/config, then the default fallback beyond loopback.
 */
export function chooseAuthSource(input: {
  loopback: boolean;
  stored: StoredPassword | null;
  envPassword: string | null;
}): AuthSource {
  if (input.stored?.kind === 'password') return 'stored';
  if (input.stored?.kind === 'none' && input.loopback) return 'none';
  if (input.envPassword !== null) return 'env';
  return input.loopback ? 'none' : 'default';
}

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
    const service = new AuthService(
      deps,
      hash || null,
      file?.token ?? deps.newToken(),
      source,
      stored,
    );
    if (!file) await service.persist();
    return service;
  }

  get required(): boolean {
    return this.hash !== null;
  }
  get isDefault(): boolean {
    return this.source === 'default';
  }
  get canDisable(): boolean {
    return this.deps.loopback;
  }
  /** Token handed out after a correct password; null while authentication is off. */
  get accessToken(): string | null {
    return this.required ? this.token : null;
  }

  verifyPassword(password: string): boolean {
    return this.hash !== null && this.deps.hasher.verify(password, this.hash);
  }

  isValidToken(provided: string | undefined): boolean {
    return !this.required || (provided !== undefined && safeEqual(this.token, provided));
  }

  /** Sets, changes (`next` set) or removes (`next` null) the password. Returns the new token. */
  async change(current: string | null, next: string | null): Promise<string | null> {
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

  private persist(): Promise<void> {
    return this.deps.store.save({ password: this.stored, token: this.token });
  }
}
