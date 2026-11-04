import type { FastifyInstance } from 'fastify';
import { DEFAULT_PASSWORD } from '../../domain/auth.js';
import { lanUrls } from '../../infrastructure/net/lanUrls.js';
import { acquireWakeLock } from '../../infrastructure/net/wakeLock.js';
import { runCommand } from '../../infrastructure/tmux/exec.js';

interface Options {
  host: string;
  port: number;
  /** False when tmux is missing: sessions then end with the server. */
  persistent: boolean;
  defaultPassword: boolean;
}

/** Starts listening and tells the user how to reach the deck and what to fix. */
export async function listen(app: FastifyInstance, options: Options): Promise<void> {
  if (!options.persistent)
    app.log.warn('tmux not found: sessions will not survive a server restart');
  await app.listen({ host: options.host, port: options.port });
  if (await acquireWakeLock(runCommand, process.env)) {
    app.log.info('Termux wake lock requested (CPU + Wi-Fi stay awake with the screen off)');
  }
  for (const url of lanUrls(options.host, options.port)) app.log.info(`Open ${url}`);
  if (options.defaultPassword) {
    app.log.warn(
      `Using the DEFAULT password "${DEFAULT_PASSWORD}". Set DECK_PASSWORD or "password" in config.json.`,
    );
  }
}
