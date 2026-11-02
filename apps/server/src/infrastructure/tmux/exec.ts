import { execFile } from 'node:child_process';

export type Runner = (command: string, args: string[], cwd?: string) => Promise<string>;

export const runCommand: Runner = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 15_000 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
