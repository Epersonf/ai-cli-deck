import {
  ProfileTemplateSchema,
  parseJsonc,
  templateProblems,
  type ProfileTemplate,
  type TemplateInfo,
} from '@deck/shared';
import { conflict, invalid, notFound } from '../domain/errors.js';
import { exportTemplate } from './templateExport.js';
import type { TemplateStorePort } from '../domain/ports.js';

export interface TemplateServiceDeps {
  store: TemplateStorePort;
  builtin: readonly ProfileTemplate[];
  /** True while any profile is made from this template. */
  inUse(id: string): boolean;
}

/** The templates profiles are made from: the ones that ship with the deck, plus imported ones. */
export class TemplateService {
  private installed: ProfileTemplate[] = [];

  constructor(private readonly deps: TemplateServiceDeps) {}

  async load(): Promise<void> {
    const builtin = new Set(this.deps.builtin.map((t) => t.id));
    this.installed = (await this.deps.store.load()).filter((t) => !builtin.has(t.id));
  }

  list(): TemplateInfo[] {
    return [
      ...this.deps.builtin.map((t) => ({ ...t, builtin: true })),
      ...this.installed.map((t) => ({ ...t, builtin: false })),
    ];
  }

  get(id: string): ProfileTemplate | undefined {
    return [...this.deps.builtin, ...this.installed].find((t) => t.id === id);
  }

  /** A template as commented JSON, to use as an example or edit. */
  exportText(id: string): string {
    const template = this.get(id);
    if (!template) throw notFound(`Template ${id}`);
    return exportTemplate(template);
  }

  /** Imports a template written as JSON (comments allowed). Same id as an imported one: it is replaced. */
  async install(text: string): Promise<TemplateInfo> {
    let raw: unknown;
    try {
      raw = parseJsonc(text);
    } catch (error) {
      throw invalid(`Not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const parsed = ProfileTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw invalid(
        `Not a profile template: ${issue?.path.join('.') || 'file'} ${issue?.message ?? ''}`.trim(),
      );
    }
    const template = parsed.data;
    const problems = templateProblems(template);
    if (problems.length > 0) throw invalid(`Template problem: ${problems.join('; ')}`);
    if (this.deps.builtin.some((t) => t.id === template.id))
      throw conflict(`"${template.id}" is a built-in template: pick another id`);
    await this.deps.store.save(template);
    this.installed = [...this.installed.filter((t) => t.id !== template.id), template];
    return { ...template, builtin: false };
  }

  async remove(id: string): Promise<void> {
    if (this.deps.builtin.some((t) => t.id === id)) throw conflict('Built-in templates stay');
    if (!this.installed.some((t) => t.id === id)) throw notFound(`Template ${id}`);
    if (this.deps.inUse(id)) throw conflict('Profiles still use this template: delete them first');
    await this.deps.store.remove(id);
    this.installed = this.installed.filter((t) => t.id !== id);
  }
}
