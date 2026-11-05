import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { MCP_PATH, SETUP_SPECS } from '@deck/shared';
import { ApprovalService } from './application/ApprovalService.js';
import { PortAllocator } from './application/PortAllocator.js';
import { PreviewService } from './application/PreviewService.js';
import { SessionLauncher } from './application/SessionLauncher.js';
import { SessionManager } from './application/SessionManager.js';
import { EventBus } from './domain/events.js';

/** How often changed terminal screens are written to disk. */
const SCROLLBACK_SAVE_MS = 5_000;
import { LoginThrottle } from './application/LoginThrottle.js';
import { AuthService } from './application/AuthService.js';
import { ScryptHasher } from './infrastructure/auth/ScryptHasher.js';
import { JsonAuthStore } from './infrastructure/auth/JsonAuthStore.js';
import { assertSecureBind, isLoopbackHost } from './infrastructure/config/bind.js';
import { loadConfig } from './infrastructure/config/loadConfig.js';
import { defaultShell } from './infrastructure/config/platform.js';
import { workspaceServices } from './infrastructure/workspaceWiring.js';
import { chatServices, createChatFiles } from './infrastructure/chatWiring.js';
import { GitCli } from './infrastructure/git/GitCli.js';
import { SystemAdapter } from './infrastructure/net/SystemAdapter.js';
import { ProviderStatusResolver, realStatusDeps } from './infrastructure/providers/status.js';
import { createConfiguredProvider } from './infrastructure/providers/configured.js';
import { createProfileService } from './infrastructure/providers/profileWiring.js';
import { createProviderRegistry } from './infrastructure/providers/registry.js';
import { NodePtyAdapter } from './infrastructure/pty/NodePtyAdapter.js';
import { createTaskService } from './infrastructure/tasks/taskWiring.js';
import { stringEnv } from './infrastructure/config/stringEnv.js';
import { phoneFromEnv } from './infrastructure/phone/HttpPhoneBridge.js';
import { FileScrollbackStore } from './infrastructure/store/FileScrollbackStore.js';
import { JsonSessionStore } from './infrastructure/store/JsonSessionStore.js';
import { runCommand } from './infrastructure/tmux/exec.js';
import { detectMultiplexer } from './infrastructure/tmux/NoMultiplexer.js';
import { createApp } from './interface/http/createApp.js';
import { listen } from './interface/http/listen.js';

async function main(): Promise<void> {
  const phone = phoneFromEnv(process.env); // before sessions copy the environment
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
  const statusResolver = new ProviderStatusResolver(
    SETUP_SPECS,
    config.providers.map((def) => ({ id: def.id, command: def.command })),
    realStatusDeps(),
  );
  const system = new SystemAdapter();
  const pty = new NodePtyAdapter();
  const mux = await detectMultiplexer(runCommand, pty);
  const git = new GitCli(runCommand);
  const bus = new EventBus();
  const shellName = defaultShell(process.env, process.platform);
  const { profiles, templates } = await createProfileService({
    configDir: paths.configDir,
    providers,
    status: statusResolver,
    defaultShell: shellName,
  });
  const chatFiles = createChatFiles(paths.stateDir);
  const launcher = new SessionLauncher({
    mux,
    providers: providers,
    mcpBaseUrl: `http://127.0.0.1:${config.port}${MCP_PATH}`,
    deckUrl: `http://127.0.0.1:${config.port}`,
    binDir: join(here, '..', 'bin'),
    baseEnv: stringEnv(),
    defaultShell: shellName,
    phoneEnabled: () => phone !== null,
    chatReportFile: (id) => chatFiles.reportFile(id),
  });
  const sessions = new SessionManager({
    launcher,
    mux,
    store: new JsonSessionStore(join(paths.stateDir, 'sessions.json')),
    scrollback: new FileScrollbackStore(join(paths.stateDir, 'scrollback')),
    ports: new PortAllocator(config.portRange, (p) => system.isPortFree(p)),
    system,
    bus,
    replayBytes: 64 * 1024,
  });
  await sessions.restore();
  const tasks = createTaskService({
    sessions,
    launcher,
    bus,
    phone,
    shellName,
    newId: () => system.newId(),
  });
  sessions.screens.start(SCROLLBACK_SAVE_MS);

  const app = await createApp({
    sessions,
    phone,
    ...chatServices({ files: chatFiles, sessions, providers, bus, system }),
    approvals: new ApprovalService({ sessions, worktrees: git, system, bus }),
    ...workspaceServices({ sessions, git }),
    preview: new PreviewService(sessions, bus),
    providers: providers,
    bus,
    providerStatus: (id) => statusResolver.resolve(id),
    profiles,
    templates,
    tasks,
    publicConfig: {
      defaultCwd: config.defaultCwd ?? homedir(),
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

  await listen(app, {
    host: config.host,
    port: config.port,
    persistent: mux.available,
    defaultPassword: auth.isDefault,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
