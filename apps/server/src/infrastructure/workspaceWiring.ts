import { join } from 'node:path';
import type { Session } from '@deck/shared';
import { GitReviewService } from '../application/GitReviewService.js';
import { WorkspaceService } from '../application/WorkspaceService.js';
import type { GitPort } from '../domain/ports.js';
import { FileReader } from './fs/FileReader.js';
import { GitReviewCli } from './git/GitReviewCli.js';
import { runGit } from './git/gitRun.js';
import { FilePromptStore } from './store/FilePromptStore.js';

interface Deps {
  sessions: { get(id: string): Session | undefined };
  git: GitPort;
  configDir: string;
}

/** What works on a session's folder: files, the git review, and the quick prompts sent into it. */
export function workspaceServices({ sessions, git, configDir }: Deps) {
  return {
    workspace: new WorkspaceService({ sessions, files: new FileReader(), git }),
    gitReview: new GitReviewService({ sessions, git: new GitReviewCli(runGit) }),
    prompts: new FilePromptStore(join(configDir, 'prompts.json')),
  };
}
