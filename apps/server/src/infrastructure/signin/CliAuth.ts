import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { AgentKind } from '@deck/shared';
import type { AuthCli, LoginChild, LoginKind } from '../../domain/signin.js';
import { resolveCodex } from '../agents/codexBin.js';
import { killTree } from '../process/killTree.js';
import { locate } from '../voice/locate.js';

/** How long `status` and `logout` may take before the answer is "unknown". */
const RUN_TIMEOUT_MS = 8000;
const ANSWER_CAP = 20_000;

interface Command {
  command: string;
  args: string[];
}

/** Claude Code as the SDK ships it (what the chats run), else a `claude` found in PATH. */
export function claudeCommand(env: Record<string, string | undefined>): string {
  try {
    const base = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
    const pkg = createRequire(import.meta.url).resolve(`${base}/package.json`);
    return join(dirname(pkg), process.platform === 'win32' ? 'claude.exe' : 'claude');
  } catch {
    return locate(['claude'], env) ?? 'claude';
  }
}

/** The agents' own login commands, started with the profile's folder in the environment. */
export class CliAuth implements AuthCli {
  constructor(private readonly baseEnv: Record<string, string>) {}

  private env(own: Record<string, string>): Record<string, string> {
    // Only the profile's folder is added: an endpoint or key must not change which account signs in.
    const env = { ...this.baseEnv, ...own };
    if (process.platform !== 'win32') env['BROWSER'] = 'true'; // the page is opened by the app, not here
    return env;
  }

  private command(agent: AgentKind, args: string[], env: Record<string, string>): Command {
    if (agent === 'claude') return { command: claudeCommand(env), args: ['auth', ...args] };
    const bin = resolveCodex(env);
    return { command: bin.command, args: [...bin.prefix, ...args] };
  }

  login(kind: LoginKind, own: Record<string, string>): LoginChild {
    const env = this.env(own);
    const { command, args } =
      kind === 'codex-chatgpt'
        ? this.command('codex', ['login', '--device-auth'], env)
        : this.command(
            'claude',
            ['login', kind === 'claude-console' ? '--console' : '--claudeai'],
            env,
          );
    const child = spawn(command, args, { env, stdio: 'pipe', windowsHide: true });
    const data: Array<(text: string) => void> = [];
    const exit: Array<(code: number | null) => void> = [];
    const tell = (text: string): void => data.forEach((l) => l(text));
    child.stdout.on('data', (chunk: Buffer) => tell(String(chunk)));
    child.stderr.on('data', (chunk: Buffer) => tell(String(chunk)));
    child.on('error', (error) => {
      tell(`Could not start the login: ${error.message}\n`);
      exit.forEach((l) => l(null));
    });
    child.on('close', (code) => exit.forEach((l) => l(code)));
    child.stdin.on('error', () => undefined);
    return {
      onData: (l) => void data.push(l),
      onExit: (l) => void exit.push(l),
      write: (text) => void child.stdin.write(text),
      kill: () => killTree(child),
    };
  }

  run(agent: AgentKind, action: 'status' | 'logout', own: Record<string, string>) {
    const env = this.env(own);
    const words =
      agent === 'claude' ? [action] : action === 'status' ? ['login', 'status'] : ['logout'];
    const { command, args } = this.command(agent, words, env);
    return new Promise<{ code: number | null; output: string } | null>((resolve) => {
      let output = '';
      const child = spawn(command, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const timer = setTimeout(() => {
        killTree(child);
        resolve(null);
      }, RUN_TIMEOUT_MS);
      const add = (chunk: Buffer): void =>
        void (output = (output + String(chunk)).slice(0, ANSWER_CAP));
      child.stdout.on('data', add);
      child.stderr.on('data', add);
      child.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, output });
      });
    });
  }
}
