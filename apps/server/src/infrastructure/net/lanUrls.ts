import { networkInterfaces } from 'node:os';

type Interfaces = ReturnType<typeof networkInterfaces>;

/** URLs a second device on the LAN can use when the server listens on all interfaces. */
export function lanUrls(
  host: string,
  port: number,
  interfaces: Interfaces = networkInterfaces(),
): string[] {
  if (host !== '0.0.0.0' && host !== '::') return [`http://${host}:${port}/`];
  return Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => `http://${address.address}:${port}/`);
}
