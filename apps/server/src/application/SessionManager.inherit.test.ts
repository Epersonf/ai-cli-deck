import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';
import { createTemplateProvider } from '../infrastructure/providers/templateProvider.js';
import { createHarness, customBody } from '../testing/harness.js';

function withProfile() {
  const h = createHarness({ tmux: false });
  const template = BUILTIN_TEMPLATES.find((t) => t.id === 'claude-endpoint');
  if (!template) throw new Error('template');
  const profile = {
    id: 'corp',
    label: 'Corp',
    base: 'claude-endpoint',
    values: { baseUrl: 'https://llm.example.com' },
  };
  h.providers.add(createTemplateProvider(profile, template, '/cfg/profiles'));
  return h;
}

describe('plain terminals opened from a profile session', () => {
  it('take the profile environment but run a simple shell, not the CLI or its key prompt', async () => {
    const h = withProfile();
    const main = await h.sessions.create({ ...customBody(), provider: 'corp', command: null });
    await h.sessions.create({
      ...customBody(),
      provider: 'shell',
      command: null,
      parentId: main.id,
    });
    const cli = h.ptyPort.spawned[0]?.spec;
    const shell = h.ptyPort.spawned[1]?.spec;
    expect(cli?.command).toBe('clideck'); // the profile's CLI asks for its key through ensure-key
    expect(shell?.command).toBe('bash');
    expect(shell?.args).toEqual([]);
    expect(shell?.env['ANTHROPIC_BASE_URL']).toBe('https://llm.example.com');
    expect(shell?.env['CLAUDE_CONFIG_DIR']).toContain('corp');
  });

  it('keep it when restarted, and a normal shell session gets nothing extra', async () => {
    const h = withProfile();
    const main = await h.sessions.create({ ...customBody(), provider: 'corp', command: null });
    const sub = await h.sessions.create({
      ...customBody(),
      provider: 'shell',
      command: null,
      parentId: main.id,
    });
    h.ptyPort.spawned[1]?.pty.exit(0);
    await h.sessions.restart(sub.id, false);
    expect(h.ptyPort.spawned[2]?.spec.env['ANTHROPIC_BASE_URL']).toBe('https://llm.example.com');
    await h.sessions.create({ ...customBody(), provider: 'shell', command: null });
    expect(h.ptyPort.spawned[3]?.spec.env['ANTHROPIC_BASE_URL']).toBeUndefined();
  });
});
