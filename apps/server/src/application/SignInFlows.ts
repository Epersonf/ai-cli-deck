import type { SignInFlow } from '@deck/shared';
import { conflict } from '../domain/errors.js';
import type { AuthCli, LoginChild, LoginKind } from '../domain/signin.js';
import { cleanOutput, readLoginOutput } from './loginOutput.js';

const MAX_OUTPUT = 6000;
/** A login nobody finishes is cut after this long. */
const LOGIN_TIMEOUT_MS = 15 * 60_000;

interface Active {
  flow: SignInFlow;
  child: LoginChild | null;
  raw: string;
}

/** The logins in progress, one per provider, in memory only. */
export class SignInFlows {
  private readonly active = new Map<string, Active>();

  constructor(
    private readonly cli: AuthCli,
    /** Asks the agent whether it is signed in now; called when the login process ends well. */
    private readonly confirm: (id: string) => Promise<boolean>,
    private readonly finished: (id: string) => void,
  ) {}

  current(id: string): SignInFlow | null {
    return this.active.get(id)?.flow ?? null;
  }

  /** Starts a login (ending one already running for this provider). */
  start(id: string, method: SignInFlow['method'], kind: LoginKind, env: Record<string, string>) {
    this.cancel(id);
    const flow: SignInFlow = {
      method,
      state: 'running',
      url: null,
      code: null,
      needsCode: false,
      output: '',
      error: null,
    };
    const entry: Active = { flow, child: null, raw: '' };
    this.active.set(id, entry);
    const child = this.cli.login(kind, env);
    entry.child = child;
    const timer = setTimeout(() => this.cancel(id), LOGIN_TIMEOUT_MS);
    timer.unref();
    child.onData((text) => this.take(entry, text));
    child.onExit((code) => {
      clearTimeout(timer);
      void this.ended(id, entry, code);
    });
    return flow;
  }

  private take(entry: Active, text: string): void {
    entry.raw = (entry.raw + text).slice(-MAX_OUTPUT);
    const progress = readLoginOutput(entry.raw);
    const kind = entry.flow.method;
    entry.flow = {
      ...entry.flow,
      output: cleanOutput(entry.raw).trim(),
      url: progress.url,
      code: kind === 'codex-chatgpt' ? progress.code : null,
      needsCode: progress.needsCode && entry.flow.state === 'running',
    };
  }

  private async ended(id: string, entry: Active, code: number | null): Promise<void> {
    if (entry.flow.state !== 'running') return; // cancelled
    const lines = entry.flow.output.split('\n').filter((l) => l.trim() !== '');
    const ok = code === 0 && (await this.confirm(id).catch(() => false));
    if (entry.flow.state !== 'running') return;
    entry.flow = {
      ...entry.flow,
      state: ok ? 'done' : 'failed',
      needsCode: false,
      error: ok ? null : (lines.at(-1) ?? `The login stopped (code ${code ?? 'none'})`),
    };
    entry.child = null;
    if (ok) this.finished(id);
  }

  /** Sends the code the person pasted to the CLI that waits for it. */
  input(id: string, text: string): SignInFlow {
    const entry = this.active.get(id);
    if (!entry || entry.flow.state !== 'running' || !entry.child)
      throw conflict('No sign-in is waiting');
    entry.child.write(`${text}\n`);
    return entry.flow;
  }

  cancel(id: string): void {
    const entry = this.active.get(id);
    if (!entry || entry.flow.state !== 'running') return;
    entry.flow = { ...entry.flow, state: 'cancelled', needsCode: false };
    entry.child?.kill();
    entry.child = null;
  }
}
