import type { Session } from '@deck/shared';
import { BrowserService } from '../application/BrowserService.js';
import { GitReviewService } from '../application/GitReviewService.js';
import { WorkspaceService } from '../application/WorkspaceService.js';
import type { GitPort } from '../domain/ports.js';
import { PlaywrightEngine } from './browser/PlaywrightEngine.js';
import { FileReader } from './fs/FileReader.js';
import { GitReviewCli } from './git/GitReviewCli.js';
import { runGit } from './git/gitRun.js';

interface Deps {
  sessions: { get(id: string): Session | undefined };
  git: GitPort;
}

/** What works around a session: its files, the git review and its browser. */
export function workspaceServices({ sessions, git }: Deps) {
  return {
    workspace: new WorkspaceService({ sessions, files: new FileReader(), git }),
    gitReview: new GitReviewService({ sessions, git: new GitReviewCli(runGit) }),
    // A session's browser opens on what its preview shows.
    browser: new BrowserService(
      new PlaywrightEngine(),
      (id) => sessions.get(id)?.previewUrl ?? null,
    ),
  };
}
