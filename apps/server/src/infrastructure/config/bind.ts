const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export const isLoopbackHost = (host: string): boolean => LOOPBACK.has(host);

/** Binding beyond loopback is only allowed with an access token. */
export function requiresToken(host: string): boolean {
  return !isLoopbackHost(host);
}

export function assertSecureBind(host: string, token: string | null): void {
  if (requiresToken(host) && (token === null || token.length < 16)) {
    throw new Error(`Refusing to bind to ${host} without an access token`);
  }
}
