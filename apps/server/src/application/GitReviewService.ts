import { basename } from 'node:path';
import type { GitChange, GitDiff, GitReview, Session } from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import type { GitReviewPort } from '../domain/ports.js';

export interface GitReviewDeps {
  sessions: { get(id: string): Session | undefined };
  git: GitReviewPort;
}

/**
 * The changes in the repository a session works in. Only paths git itself reports as changed are acted on,
 * so a request can never reach a file outside the repository.
 */
export class GitReviewService {
  constructor(private readonly deps: GitReviewDeps) {}

  async review(sessionId: string): Promise<GitReview> {
    const root = await this.deps.git.root(this.cwd(sessionId));
    if (!root) return { isRepo: false, repo: null, branch: null, ahead: null, changes: [] };
    return { isRepo: true, repo: basename(root), ...(await this.deps.git.status(root)) };
  }

  async diff(sessionId: string, path: string): Promise<GitDiff> {
    const root = await this.root(sessionId);
    return this.deps.git.diff(root, await this.change(root, path));
  }

  async discard(sessionId: string, path: string): Promise<void> {
    const root = await this.root(sessionId);
    await this.deps.git.discard(root, await this.change(root, path));
  }

  async commit(sessionId: string, message: string, paths: readonly string[]): Promise<string> {
    const root = await this.root(sessionId);
    const { changes } = await this.deps.git.status(root);
    const chosen = paths.map((path) => this.pick(changes, path));
    return this.deps.git.commit(root, message, chosen);
  }

  async push(sessionId: string): Promise<string> {
    return this.deps.git.push(await this.root(sessionId));
  }

  private async root(sessionId: string): Promise<string> {
    const root = await this.deps.git.root(this.cwd(sessionId));
    if (!root) throw invalid('This session is not in a git repository');
    return root;
  }

  private async change(root: string, path: string): Promise<GitChange> {
    return this.pick((await this.deps.git.status(root)).changes, path);
  }

  private pick(changes: readonly GitChange[], path: string): GitChange {
    const change = changes.find((c) => c.path === path);
    if (!change) throw notFound(`Change ${path}`);
    return change;
  }

  private cwd(sessionId: string): string {
    const session = this.deps.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    return session.cwd;
  }
}
