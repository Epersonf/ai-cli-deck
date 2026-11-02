const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export const isLoopbackHost = (host: string): boolean => LOOPBACK.has(host);

/** Binding beyond loopback is only allowed while authentication is on. */
export function assertSecureBind(host: string, authRequired: boolean): void {
  if (!isLoopbackHost(host) && !authRequired) {
    throw new Error(`Refusing to listen on ${host} without a password`);
  }
}
