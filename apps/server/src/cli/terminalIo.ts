import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { findExecutable, realStatusDeps } from '../infrastructure/providers/status.js';
import type { SetupIo } from './setup.js';

export const terminalIo: SetupIo = {
  platform: process.platform,
  say: (text) => console.log(text),
  async ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  },
  run: (argv) =>
    new Promise((resolve) => {
      const [command = '', ...args] = argv;
      const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
      child.on('error', () => resolve(127));
      child.on('close', (code) => resolve(code ?? 1));
    }),
  has: (binary) => findExecutable(binary, realStatusDeps()),
};
