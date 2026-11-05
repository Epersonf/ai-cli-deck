import { mkdirSync } from 'node:fs';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { CHAT_ID } from '@deck/shared';
import type { ChatFilesPort } from '../../domain/chat.js';
import type { GitRun } from '../git/gitRun.js';
import { obj, str } from './jsonLines.js';

/** Inside the project, so any CLI may read it without asking; kept out of git. */
const TRANSCRIPT_DIR = '.deck/chats';
const IGNORE_LINE = '.deck/';

/** Chat notes on disk: what each session's CLI reports, and transcripts handed to another AI. */
export class ChatFiles implements ChatFilesPort {
  /** `dir`: where the CLIs report their current chat (one small JSON file per session). */
  constructor(
    private readonly dir: string,
    private readonly git: GitRun,
  ) {
    mkdirSync(dir, { recursive: true }); // the CLI writes there with a plain `cat >`
  }

  reportFile(sessionId: string): string {
    return join(this.dir, `${sessionId}.json`);
  }

  async reported(sessionId: string): Promise<{ id: string; path: string } | null> {
    try {
      const data = obj(JSON.parse(await readFile(this.reportFile(sessionId), 'utf8')));
      const id = str(data?.session_id);
      return id && CHAT_ID.test(id) ? { id, path: str(data?.transcript_path) ?? '' } : null;
    } catch {
      return null; // this CLI does not report, or has not started a chat yet
    }
  }

  /** Drops what an earlier run reported (a restarted terminal may run another CLI). */
  forget(sessionId: string): Promise<void> {
    return rm(this.reportFile(sessionId), { force: true });
  }

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
