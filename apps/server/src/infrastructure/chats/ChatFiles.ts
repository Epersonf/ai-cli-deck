import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ChatFilesPort } from '../../domain/chat.js';
import type { GitRun } from '../git/gitRun.js';

/** Inside the project, so any agent may read it without asking; kept out of git. */
const TRANSCRIPT_DIR = '.deck/chats';
const IGNORE_LINE = '.deck/';

/** Transcripts handed to another AI, saved in the project folder. */
export class ChatFiles implements ChatFilesPort {
  constructor(private readonly git: GitRun) {}

  async writeTranscript(cwd: string, name: string, text: string): Promise<string> {
    const dir = join(cwd, TRANSCRIPT_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), text, 'utf8');
    await this.keepOutOfGit(cwd);
    return `${TRANSCRIPT_DIR}/${name}`;
  }

  /** Lists `.deck/` in the repository's local exclude file (never in a tracked .gitignore). */
  private async keepOutOfGit(cwd: string): Promise<void> {
    try {
      const { out } = await this.git(['rev-parse', '--git-path', 'info/exclude'], cwd);
      const file = resolve(cwd, out.trim());
      const current = await readFile(file, 'utf8').catch(() => '');
      if (current.split(/\r?\n/).some((line) => line.trim() === IGNORE_LINE)) return;
      await mkdir(dirname(file), { recursive: true });
      const gap = current === '' || current.endsWith('\n') ? '' : '\n';
      await appendFile(file, `${gap}${IGNORE_LINE}\n`);
    } catch {
      // not a git repository: nothing to keep out of
    }
  }
}
