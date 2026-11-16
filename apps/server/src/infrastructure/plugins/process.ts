import { execFile, spawn } from 'node:child_process';
import type { LoginChild } from '../../domain/signin.js';
import { killTree } from '../process/killTree.js';

export function runPluginCommand(
  argv: readonly string[],
  env: Record<string, string>,
  timeout = 300_000,
  cwd?: string,
): Promise<{ code: number; output: string }> {
  const [command, ...args] = argv;
  if (!command) return Promise.reject(new Error('The plugin returned an empty command'));
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        env,
        ...(cwd ? { cwd } : {}),
        timeout,
        maxBuffer: 4 << 20,
        windowsHide: true,
        shell: process.platform === 'win32' && /(?:^|[/\\])npm(?:\.cmd)?$/.test(command),
      },
      (error, stdout, stderr) =>
        resolve({
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          output: `${stdout}${stderr}`.slice(-4000),
        }),
    );
  });
}

export function startPluginLogin(argv: readonly string[], env: Record<string, string>): LoginChild {
  const [command, ...args] = argv;
  if (!command) throw new Error('The plugin returned an empty login command');
  const child = spawn(command, args, { env, stdio: 'pipe', windowsHide: true });
  const data: Array<(text: string) => void> = [];
  const exit: Array<(code: number | null) => void> = [];
  let done = false;
  const tell = (text: string): void => data.forEach((listener) => listener(text));
  const end = (code: number | null): void => {
    if (!done) {
      done = true;
      exit.forEach((listener) => listener(code));
    }
  };
  child.stdout.on('data', (chunk: Buffer) => tell(String(chunk)));
  child.stderr.on('data', (chunk: Buffer) => tell(String(chunk)));
  child.on('error', (error) => {
    tell(error.message);
    end(null);
  });
  child.on('close', end);
  child.stdin.on('error', () => undefined);
  return {
    onData: (listener) => void data.push(listener),
    onExit: (listener) => void exit.push(listener),
    write: (text) => void child.stdin.write(text),
    kill: () => killTree(child),
  };
}
