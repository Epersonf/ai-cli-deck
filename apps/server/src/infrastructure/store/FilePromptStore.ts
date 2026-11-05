import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { QuickPromptsSchema, type QuickPrompt } from '@deck/shared';
import type { PromptStorePort } from '../../domain/ports.js';

/** The quick prompts as one JSON file; a missing or broken file means "not saved yet". */
export class FilePromptStore implements PromptStorePort {
  constructor(private readonly file: string) {}

  async load(): Promise<QuickPrompt[] | null> {
    try {
      const parsed = QuickPromptsSchema.safeParse(JSON.parse(await readFile(this.file, 'utf8')));
      return parsed.success ? parsed.data.prompts : null;
    } catch {
      return null;
    }
  }

  async save(prompts: readonly QuickPrompt[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ prompts }, null, 2), { mode: 0o600 });
  }
}
