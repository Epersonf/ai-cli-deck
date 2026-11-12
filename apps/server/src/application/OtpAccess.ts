import type { OtpSetup, SetAuthModeBody } from '@deck/shared';
import { conflict, invalid } from '../domain/errors.js';
import { checkTotp, otpauthUri, secondsLeft, totpCode } from '../domain/totp.js';
import type { AuthService } from './AuthService.js';
import type { OtpThrottle } from './OtpThrottle.js';

/** A code that was refused: wrong (401, with the tries left) or the client is locked (429, with the wait). */
export class OtpRefused extends Error {
  constructor(
    readonly status: 401 | 429,
    readonly triesLeft: number,
    readonly wait: number,
  ) {
    super(status === 401 ? 'Wrong code' : `Too many wrong codes. Try again in ${wait}s`);
  }
}

export interface OtpAccessDeps {
  auth: AuthService;
  throttle: OtpThrottle;
  now(): number;
  newSecret(): string;
  /** What the authenticator app calls this deck. */
  label(): string;
}

/** Signing in with one-time codes, and moving between that and a static password. */
export class OtpAccess {
  constructor(private readonly d: OtpAccessDeps) {}

  /**
   * One try with `code` against `secret` for this client: nothing happens when it is right (and the client is
   * forgiven); otherwise it counts, and the client may end up locked. Locked clients are refused before the
   * code is even looked at, so a right code does not get through a lock.
   */
  private attempt(key: string, code: string | undefined, secret: string | null): void {
    const { throttle } = this.d;
    const wait = throttle.check(key);
    if (wait > 0) throw new OtpRefused(429, 0, wait);
    if (code !== undefined && secret !== null && checkTotp(secret, code, this.d.now())) {
      throttle.succeed(key);
      return;
    }
    throw new OtpRefused(401, throttle.fail(key).triesLeft, 0);
  }

  /** Signing in (OTP mode): the access token for a right code. */
  login(key: string, code: string | undefined): string | null {
    this.attempt(key, code, this.d.auth.otpSecrets.active);
    return this.d.auth.accessToken;
  }

  private setupOf(secret: string, active: boolean): OtpSetup {
    const now = this.d.now();
    return {
      secret,
      uri: otpauthUri(secret, this.d.label()),
      code: totpCode(secret, now),
      expiresIn: secondsLeft(now),
      active,
    };
  }

  /** The secret in use, or the pending one (made when there is none yet) while OTP is off. */
  async setup(): Promise<OtpSetup> {
    const { auth } = this.d;
    const { active, pending } = auth.otpSecrets;
    if (auth.mode === 'otp' && active) return this.setupOf(active, true);
    if (pending) return this.setupOf(pending, false);
    const fresh = this.d.newSecret();
    await auth.update({ pendingOtp: fresh });
    return this.setupOf(fresh, false);
  }

  /**
   * A new secret. While OTP is on, a code of the current one is needed; the access token stays valid, only
   * future sign-ins change. While off, the pending secret is simply replaced.
   */
  async rotate(key: string, code: string | undefined): Promise<OtpSetup> {
    const { auth } = this.d;
    const fresh = this.d.newSecret();
    if (auth.mode !== 'otp') {
      await auth.update({ pendingOtp: fresh });
      return this.setupOf(fresh, false);
    }
    this.attempt(key, code, auth.otpSecrets.active);
    await auth.update({ otp: fresh });
    return this.setupOf(fresh, true);
  }

  /** Changes the mode after proving a code; returns the access token the caller should use from now on. */
  async switchMode(key: string, body: SetAuthModeBody): Promise<string | null> {
    const { auth } = this.d;
    if (body.mode === auth.mode) throw conflict(`Already in ${body.mode} mode`);
    if (body.mode === 'otp') {
      const { pending } = auth.otpSecrets;
      if (!pending) throw invalid('Set up an authenticator first (GET /api/auth/otp)');
      this.attempt(key, body.code, pending);
      // Sessions made with the static password end: whoever knew it must now have the authenticator.
      return auth.update({ mode: 'otp', otp: pending, pendingOtp: null, newToken: auth.required });
    }
    this.attempt(key, body.code, auth.otpSecrets.active);
    return auth.update({ mode: 'static', otp: null, pendingOtp: null, password: body.password });
  }
}
