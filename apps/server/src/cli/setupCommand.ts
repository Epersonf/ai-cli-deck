import { join } from 'node:path';
import { ProviderPlugins } from '../infrastructure/plugins/registry.js';
import { pluginContext } from '../infrastructure/plugins/context.js';
import { createBuiltin } from '../infrastructure/providers/claude.js';
import { loadConfig } from '../infrastructure/config/loadConfig.js';
import { terminalIo } from './terminalIo.js';

/** The CLI and the web UI invoke the same plugin installer. */
export async function runSetup(providerId: string | null): Promise<string> {
  const { paths } = await loadConfig(process.env);
  const plugins = new ProviderPlugins(join(paths.configDir, 'plugins'));
  await plugins.load();
  const plugin = providerId ? plugins.get(providerId) : undefined;
  if (!plugin)
    return `Usage: clideck setup <provider> (providers: ${plugins
      .list()
      .map((item) => item.id)
      .join(', ')})`;
  const template = plugin.manifest.template;
  const profile = { id: template.id, label: template.label, base: template.id, values: {} };
  const hooks = plugin.create(
    pluginContext(
      profile,
      paths.configDir,
      createBuiltin(profile.id, profile.label, template.agent),
    ),
  );
  if (await hooks.installed()) return `${template.label} is already installed.`;
  const answer = await terminalIo.ask(
    `Install ${template.label} using its provider plugin? [Y/n] `,
  );
  if (/^n/i.test(answer.trim())) return 'Skipped.';
  const result = await hooks.install();
  return `${result.ok ? 'Installed.' : 'Installation failed.'}\n${result.output}`;
}
