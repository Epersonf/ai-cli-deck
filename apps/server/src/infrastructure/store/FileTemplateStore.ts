import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProfileTemplateSchema, type ProfileTemplate } from '@deck/shared';
import type { TemplateStorePort } from '../../domain/ports.js';

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** Imported profile templates: one `<id>.json` file each. Files that do not parse are skipped. */
export class FileTemplateStore implements TemplateStorePort {
  constructor(private readonly dir: string) {}

  async load(): Promise<ProfileTemplate[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const found: ProfileTemplate[] = [];
    for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
      try {
        const parsed = ProfileTemplateSchema.safeParse(
          JSON.parse(await readFile(join(this.dir, name), 'utf8')),
        );
        if (parsed.success && `${parsed.data.id}.json` === name) found.push(parsed.data);
      } catch {
        // an unreadable file is not a template
      }
    }
    return found;
  }

  async save(template: ProfileTemplate): Promise<void> {
    if (!SAFE_ID.test(template.id)) return;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, `${template.id}.json`), JSON.stringify(template, null, 2), {
      mode: 0o600,
    });
  }

  async remove(id: string): Promise<void> {
    if (SAFE_ID.test(id)) await rm(join(this.dir, `${id}.json`), { force: true });
  }
}
