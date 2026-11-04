import { join } from 'node:path';
import { fieldVars, fillText, type Profile, type ProfileTemplate } from '@deck/shared';
import type { Provider, ProviderContext } from '../../domain/provider.js';
import { AGENT_GUIDE } from './agentGuide.js';

/** Everything a template may refer to with `{name}`, for one launch. */
function varsFor(
  template: ProfileTemplate,
  profile: Profile,
  home: string,
  ctx: ProviderContext,
): Record<string, string> {
  const mcpConfig = JSON.stringify({ mcpServers: { deck: { type: 'http', url: ctx.mcpUrl } } });
  return {
    home,
    port: String(ctx.port),
    cwd: ctx.cwd,
    mcpUrl: ctx.mcpUrl,
    mcpUrlJson: JSON.stringify(ctx.mcpUrl),
    mcpConfig,
    guide: AGENT_GUIDE,
    guideJson: JSON.stringify(AGENT_GUIDE),
    ...fieldVars(template, profile.values),
  };
}

/**
 * A clean terminal from a template: its own config folder (so its own login and key), the program, arguments
 * and variables the template names, and a hidden prompt for the API key when the template asks for one.
 */
export function createTemplateProvider(
  profile: Profile,
  template: ProfileTemplate,
  profilesDir: string,
): Provider {
  const home = join(profilesDir, profile.id);
  const fill = (ctx: ProviderContext) => {
    const vars = varsFor(template, profile, home, ctx);
    return (text: string): string => fillText(text, vars);
  };
  return {
    id: profile.id,
    label: profile.label,
    buildCommand: (ctx) => {
      const sub = fill(ctx);
      const program = sub(template.command).trim() || ctx.defaultShell;
      const args = [...template.args.map(sub), ...ctx.args];
      const env = Object.fromEntries(Object.entries(template.env).map(([k, v]) => [k, sub(v)]));
      if (template.home) env[template.home.env] = home;
      const key = template.apiKey;
      if (key === null) return { command: program, args, env };
      const save = key.remember ? ['--save', home] : [];
      return {
        command: 'clideck',
        args: ['ensure-key', key.env, sub(key.label), ...save, '--', program, ...args],
        env,
      };
    },
    buildMcpConfig: (ctx) => ({ args: template.mcpArgs.map(fill(ctx)), env: {} }),
  };
}
