import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fieldVars, fillText, type Profile, type ProfileTemplate } from '@deck/shared';
import type { Provider, ProviderContext } from '../../domain/provider.js';
import { chatSupport } from '../chats/chatSupport.js';
import { readLegacyKey, readSecret } from './profileSecret.js';
import { discoverLimits } from './limitDiscovery.js';
import { discoverModels } from './modelDiscovery.js';

/** Everything a template may refer to with `{name}`, for one launch. */
function varsFor(
  template: ProfileTemplate,
  profile: Profile,
  home: string,
  ctx: ProviderContext,
): Record<string, string> {
  return {
    home,
    port: String(ctx.port),
    cwd: ctx.cwd,
    mcpUrl: ctx.mcpUrl,
    ...fieldVars(template, profile.values),
  };
}

/** The variable a key is handed over in: a Claude Code token (`sk-ant-oat...`) has its own. */
function keyEnv(template: ProfileTemplate, secret: string): string {
  const env = template.apiKey?.env ?? '';
  return template.agent === 'claude' &&
    env === 'ANTHROPIC_API_KEY' &&
    secret.startsWith('sk-ant-oat')
    ? 'CLAUDE_CODE_OAUTH_TOKEN'
    : env;
}

/**
 * An agent profile from a template: its own config folder (so its own login and key), the variables the
 * template names and the key typed for it. A profile whose key is optional and empty uses the machine's
 * own sign-in instead, so it gets no folder of its own.
 */
export function createTemplateProvider(
  profile: Profile,
  template: ProfileTemplate,
  profilesDir: string,
): Provider {
  const home = join(profilesDir, profile.id);
  const secret = (): string =>
    template.apiKey ? readSecret(home) || readLegacyKey(home, template.apiKey.env) : '';
  const marker = join(home, '.deck-login');
  const ownHome = (): boolean =>
    template.home !== null &&
    (!template.apiKey || template.apiKey.required || secret() !== '' || existsSync(marker));
  const envFor = (ctx: ProviderContext): Record<string, string> => {
    const vars = varsFor(template, profile, home, ctx);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(template.env)) {
      const filled = fillText(value, vars).trim();
      if (filled !== '') env[key] = filled;
    }
    if (template.home && ownHome()) env[template.home.env] = home;
    const key = secret();
    if (template.apiKey && key !== '') env[keyEnv(template, key)] = key;
    return env;
  };
  return {
    id: profile.id,
    label: profile.label,
    agent: template.agent,
    discoverModels: () =>
      discoverModels(
        template.agent,
        envFor({ sessionId: '', cwd: homedir(), port: 0, mcpUrl: '', guide: '' }),
      ),
    discoverLimits: () =>
      discoverLimits(
        template.agent,
        envFor({ sessionId: '', cwd: homedir(), port: 0, mcpUrl: '', guide: '' }),
      ),
    buildAgent: (ctx) => ({ kind: template.agent, env: envFor(ctx), model: template.model }),
    shellEnv: envFor,
    chat: chatSupport(template.agent, template.home && ownHome() ? home : null),
    login: {
      env: () => {
        if (!template.home) return {};
        mkdirSync(home, { recursive: true });
        return { [template.home.env]: home };
      },
      own: ownHome,
      setOwn: (on) => {
        if (on) {
          mkdirSync(home, { recursive: true });
          writeFileSync(marker, 'signed in from the deck');
        } else rmSync(marker, { force: true });
      },
    },
    signIn: template.apiKey?.required ? 'key' : 'account',
    keyState: () => {
      if (!template.apiKey) return 'none';
      if (secret() !== '') return 'set';
      return template.apiKey.required ? 'missing' : 'none';
    },
  };
}
