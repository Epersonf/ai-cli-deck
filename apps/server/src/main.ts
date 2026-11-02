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
import { assertSecureBind, requiresToken } from './infrastructure/config/bind.js';
import { loadConfig, loadOrCreateToken } from './infrastructure/config/loadConfig.js';
import { FileReader } from './infrastructure/fs/FileReader.js';
import { GitCli } from './infrastructure/git/GitCli.js';
import { SystemAdapter } from './infrastructure/net/SystemAdapter.js';
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
  const token = requiresToken(config.host) ? await loadOrCreateToken(paths.configDir) : null;
  assertSecureBind(config.host, token);

  const system = new SystemAdapter();
  const mux = await detectMultiplexer(runCommand);
  const git = new GitCli(runCommand);
  const bus = new EventBus();
  const launcher = new SessionLauncher({
    pty: new NodePtyAdapter(),
    mux,
    providers: createProviderRegistry(),
    mcpBaseUrl: `http://127.0.0.1:${config.port}${MCP_PATH}`,
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

  const here = dirname(fileURLToPath(import.meta.url));
  const app = await createApp({
    sessions,
    approvals: new ApprovalService({ sessions, worktrees: git, system, bus }),
    workspace: new WorkspaceService({ sessions, files: new FileReader(), git }),
    preview: new PreviewService(sessions, bus),
    providers: createProviderRegistry(),
    bus,
    publicConfig: {
      defaultCwd: config.defaultCwd,
      extraKeys: config.extraKeys,
      persistent: mux.available,
      tokenRequired: token !== null,
    },
    security: { bindHost: config.host, token, allowedOrigins: config.allowedOrigins },
    staticDir: paths.staticDir ?? join(here, '..', '..', 'web', 'dist'),
  });

  if (!mux.available) app.log.warn('tmux not found: sessions will not survive a server restart');
  await app.listen({ host: config.host, port: config.port });
  if (token !== null) app.log.info(`Open http://<this-device>:${config.port}/?token=${token}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
