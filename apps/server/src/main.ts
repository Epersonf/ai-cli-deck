import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_PATH } from '@deck/shared';
import { ApprovalService } from './application/ApprovalService.js';
import { PortAllocator } from './application/PortAllocator.js';
import { PreviewService } from './application/PreviewService.js';
import { SessionLauncher } from './application/SessionLauncher.js';
import { SessionManager } from './application/SessionManager.js';
import { WorkspaceService } from './application/WorkspaceService.js';
import { EventBus } from './domain/events.js';
import { LoginThrottle } from './application/LoginThrottle.js';
import { AuthService } from './application/AuthService.js';
import { DEFAULT_PASSWORD } from './domain/auth.js';
import { ScryptHasher } from './infrastructure/auth/ScryptHasher.js';
import { JsonAuthStore } from './infrastructure/auth/JsonAuthStore.js';
import { assertSecureBind, isLoopbackHost } from './infrastructure/config/bind.js';
import { loadConfig } from './infrastructure/config/loadConfig.js';
import { FileReader } from './infrastructure/fs/FileReader.js';
import { GitCli } from './infrastructure/git/GitCli.js';
import { lanUrls } from './infrastructure/net/lanUrls.js';
import { SystemAdapter } from './infrastructure/net/SystemAdapter.js';
import { createConfiguredProvider } from './infrastructure/providers/configured.js';
import { createProviderRegistry } from './infrastructure/providers/registry.js';
import { NodePtyAdapter } from './infrastructure/pty/NodePtyAdapter.js';
import { JsonSessionStore } from './infrastructure/store/JsonSessionStore.js';
import { runCommand } from './infrastructure/tmux/exec.js';
import { detectMultiplexer } from './infrastructure/tmux/NoMultiplexer.js';
import { createApp } from './interface/http/createApp.js';

function stringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}

async function main(): Promise<void> {
  const { config, paths } = await loadConfig(process.env);
  const auth = await AuthService.create({
    store: new JsonAuthStore(join(paths.configDir, 'auth.json')),
    hasher: new ScryptHasher(),
    newToken: () => randomBytes(24).toString('base64url'),
    loopback: isLoopbackHost(config.host),
    envPassword: config.password,
  });
  assertSecureBind(config.host, auth.required);

  const here = dirname(fileURLToPath(import.meta.url));
  const providers = createProviderRegistry(
    undefined,
    config.providers.map(createConfiguredProvider),
  );
  const system = new SystemAdapter();
  const mux = await detectMultiplexer(runCommand);
  const git = new GitCli(runCommand);
  const bus = new EventBus();
  const launcher = new SessionLauncher({
    pty: new NodePtyAdapter(),
    mux,
    providers: providers,
    mcpBaseUrl: `http://127.0.0.1:${config.port}${MCP_PATH}`,
    deckUrl: `http://127.0.0.1:${config.port}`,
    binDir: join(here, '..', 'bin'),
    baseEnv: stringEnv(),
    secrets: { deepseekApiKey: config.deepseekApiKey },
  });
  const sessions = new SessionManager({
    launcher,
    mux,
    store: new JsonSessionStore(join(paths.stateDir, 'sessions.json')),
    ports: new PortAllocator(config.portRange, (p) => system.isPortFree(p)),
    system,
    bus,
    replayBytes: 64 * 1024,
  });
  await sessions.restore();

  const app = await createApp({
    sessions,
    approvals: new ApprovalService({ sessions, worktrees: git, system, bus }),
    workspace: new WorkspaceService({ sessions, files: new FileReader(), git }),
    preview: new PreviewService(sessions, bus),
    providers: providers,
    bus,
    publicConfig: {
      defaultCwd: config.defaultCwd,
      extraKeys: config.extraKeys,
      persistent: mux.available,
    },
    auth,
    throttle: new LoginThrottle(() => Date.now()),
    security: {
      bindHost: config.host,
      allowedOrigins: config.allowedOrigins,
      isValidToken: (token) => auth.isValidToken(token),
    },
    staticDir: paths.staticDir ?? join(here, '..', '..', 'web', 'dist'),
  });

  if (!mux.available) app.log.warn('tmux not found: sessions will not survive a server restart');
  await app.listen({ host: config.host, port: config.port });
  for (const url of lanUrls(config.host, config.port)) app.log.info(`Open ${url}`);
  if (auth.isDefault) {
    app.log.warn(
      `Using the DEFAULT password "${DEFAULT_PASSWORD}". Set DECK_PASSWORD or "password" in config.json.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
