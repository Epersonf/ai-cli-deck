import type { ProfileTemplate } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';
import { TEMPLATE_SKELETON } from '../infrastructure/providers/templateSkeleton.js';
import { TemplateService } from './TemplateService.js';

function setup(inUse: (id: string) => boolean = () => false) {
  const saved = new Map<string, ProfileTemplate>();
  const service = new TemplateService({
    store: {
      load: () => Promise.resolve([...saved.values()]),
      save: (t) => (saved.set(t.id, t), Promise.resolve()),
      remove: (id) => (saved.delete(id), Promise.resolve()),
    },
    builtin: BUILTIN_TEMPLATES,
    inUse,
  });
  return { service, saved };
}

const minimal = (extra = '') =>
  `{ "schema": 1, "id": "gemini", "label": "Gemini", "command": "gemini" ${extra} }`;

describe('TemplateService', () => {
  it('lists the built-in templates first, flagged as such', () => {
    const list = setup().service.list();
    expect(list.map((t) => t.id)).toEqual([
      'claude',
      'claude-endpoint',
      'claude-deepseek',
      'codex',
      'custom',
    ]);
    expect(list.every((t) => t.builtin)).toBe(true);
  });

  it('the downloadable example is itself a valid template (comments and all)', async () => {
    const { service } = setup();
    const info = await service.install(TEMPLATE_SKELETON);
    expect(info).toMatchObject({ id: 'my-ai-cli', builtin: false });
  });

  it('imports a template, keeps it across restarts, and replaces one with the same id', async () => {
    const { service, saved } = setup();
    await service.install(minimal());
    await service.install(minimal(', "description": "v2"'));
    expect(service.get('gemini')?.description).toBe('v2');
    expect([...saved.keys()]).toEqual(['gemini']);
    await service.load();
    expect(service.list().map((t) => t.id)).toContain('gemini');
  });

  it('refuses to shadow a built-in template', async () => {
    const { service } = setup();
    await expect(
      service.install('{ "schema": 1, "id": "claude", "label": "Mine" }'),
    ).rejects.toThrow(/built-in/);
  });

  it('explains what is wrong with a file', async () => {
    const { service } = setup();
    await expect(service.install('{ nope')).rejects.toThrow(/Not valid JSON/);
    await expect(service.install('{ "schema": 2, "id": "x", "label": "X" }')).rejects.toThrow(
      /Not a profile template: schema/,
    );
    await expect(service.install(minimal(', "env": { "A": "{nothing}" }'))).rejects.toThrow(
      /unknown placeholder \{nothing\}/,
    );
    await expect(
      service.install(minimal(', "fields": [{"key":"a","label":"A"},{"key":"a","label":"B"}]')),
    ).rejects.toThrow(/unique/);
  });

  it('removes imported templates only when no profile uses them, never the built-in ones', async () => {
    let used = true;
    const { service } = setup(() => used);
    await service.install(minimal());
    await expect(service.remove('gemini')).rejects.toThrow(/still use/);
    used = false;
    await service.remove('gemini');
    expect(service.get('gemini')).toBeUndefined();
    await expect(service.remove('claude')).rejects.toThrow(/Built-in/);
    await expect(service.remove('ghost')).rejects.toThrow(/not found/);
  });
});
