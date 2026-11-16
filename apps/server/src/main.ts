import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { MCP_PATH, SETUP_SPECS } from '@deck/shared';
import { PortAllocator } from './application/PortAllocator.js';
import { PreviewService } from './application/PreviewService.js';
import { AgentLauncher } from './application/AgentLauncher.js';
import { SessionManager } from './application/SessionManager.js';
import { EventBus } from './domain/events.js';
import { LoginThrottle } from './application/LoginThrottle.js';
import { assertSecureBind } from './infrastructure/config/bind.js';
import { createAuth, createOtp } from './infrastructure/auth/authWiring.js';
import { loadConfig } from './infrastructure/config/loadConfig.js';
import { defaultShell } from './infrastructure/config/platform.js';
import { workspaceServices } from './infrastructure/workspaceWiring.js';
import { chatServices } from './infrastructure/chatWiring.js';
import { networkServices } from './infrastructure/networkWiring.js';
import { createMachine } from './infrastructure/machine/machineWiring.js';
import { GitCli } from './infrastructure/git/GitCli.js';
import { SystemAdapter } from './infrastructure/net/SystemAdapter.js';
import { ProviderStatusResolver, realStatusDeps } from './infrastructure/providers/status.js';
import { createProfileService } from './infrastructure/providers/profileWiring.js';
import { createProviderRegistry } from './infrastructure/providers/registry.js';
import { createTaskService } from './infrastructure/tasks/taskWiring.js';
import { stringEnv } from './infrastructure/config/stringEnv.js';
import { phoneFromEnv } from './infrastructure/phone/HttpPhoneBridge.js';
import { FileChatLog } from './infrastructure/store/FileChatLog.js';
import { createSignIn } from './infrastructure/signin/signInWiring.js';
import { createVoice } from './infrastructure/voice/voiceWiring.js';
import { createAgentPort } from './infrastructure/agents/agentPort.js';
import { FileUsageHistoryStore } from './infrastructure/store/FileUsageHistoryStore.js';
import { FileBriefingStore } from './infrastructure/store/FileBriefingStore.js';
import { JsonSessionStore } from './infrastructure/store/JsonSessionStore.js';
import { memoryServices } from './infrastructure/memoryWiring.js';
import { runCommand } from './infrastructure/machine/exec.js';
import { createApp } from './interface/http/createApp.js';
import { liveServices } from './application/liveServices.js';
import { listen } from './interface/http/listen.js';

async function main(): Promise<void> {
  const phone = phoneFromEnv(process.env); // before sessions copy the environment
  const { config, paths } = await loadConfig(process.env);
  const auth = await createAuth(paths.configDir, config.host, config.password);
  assertSecureBind(config.host, auth.required);

  const here = dirname(fileURLToPath(import.meta.url));
  const providers = createProviderRegistry();
  const statusResolver = new ProviderStatusResolver(SETUP_SPECS, realStatusDeps());
  const system = new SystemAdapter();
  const git = new GitCli(runCommand);
  const bus = new EventBus();
  const shellName = defaultShell(process.env, process.platform);
  const profileWiring = await createProfileService({
    configDir: paths.configDir,
    providers,
    status: statusResolver,
  });
  const { isPeerToken, ...network } = await networkServices({
    ...paths,
    ...config,
    name: process.env['DECK_NAME'],
  });
  const kept = await memoryServices({ ...paths, providers, bus, system });
  const launcher = new AgentLauncher({
    providers,
    briefingStore: new FileBriefingStore(join(paths.stateDir, 'briefings')),
    mcpBaseUrl: `http://127.0.0.1:${config.port}${MCP_PATH}`,
    deckUrl: `http://127.0.0.1:${config.port}`,
    binDir: join(here, '..', 'bin'),
    baseEnv: stringEnv(),
    ...kept.launcher,
    phoneEnabled: () => phone !== null,
    pairedDevices: () => network.network.peers().map((peer) => peer.name),
  });
  const sessions = new SessionManager({
    limits: kept.limits,
    models: kept.models,
    catalog: kept.catalog,
    launcher,
    usageHistoryStore: new FileUsageHistoryStore(join(paths.stateDir, 'usage')),
    agent: createAgentPort(providers),
    providers,
    store: new JsonSessionStore(join(paths.stateDir, 'sessions.json')),
    log: new FileChatLog(join(paths.stateDir, 'chats')),
    ports: new PortAllocator(config.portRange, (p) => system.isPortFree(p)),
    system,
    bus,
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

  const app = await createApp({
    sessions,
    phone,
    ...chatServices({ sessions, providers, system }),
    ...liveServices({
      worktrees: git,
      system,
      sessions,
      bus,
      phone,
      port: config.port,
      memory: kept.memory,
      providers,
    }),
    ...workspaceServices({ sessions, git }),
    preview: new PreviewService(sessions, bus),
    providers,
    bus,
    providerStatus: (id) => statusResolver.resolve(id),
    ...profileWiring,
    tasks,
    models: kept.models,
    catalog: kept.catalog,
    memory: kept.memory,
    signIn: createSignIn(providers, profileWiring.profiles),
    voice: createVoice(paths.stateDir),
    ...network,
    machine: createMachine({ defaultCwd: config.defaultCwd ?? homedir() }),
    publicConfig: { defaultCwd: config.defaultCwd ?? homedir() },
    auth,
    throttle: new LoginThrottle(() => Date.now()),
    otp: createOtp(auth),
    security: {
      bindHost: config.host,
      allowedOrigins: config.allowedOrigins,
      isValidToken: (token, local) => auth.isValidToken(token, local) || isPeerToken(token),
    },
    staticDir: paths.staticDir ?? join(here, '..', '..', 'web', 'dist'),
  });

  await listen(app, {
    host: config.host,
    port: config.port,
    defaultPassword: auth.isDefault,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
