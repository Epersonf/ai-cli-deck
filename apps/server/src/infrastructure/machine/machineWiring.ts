import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolveCwd } from '../../application/cwd.js';
import type { ExecBody, ExecResult } from '@deck/shared';
import { invalid } from '../../domain/errors.js';
import { defaultShell } from '../config/platform.js';
import { runShell } from './runShell.js';

/** This machine, for a paired deck's agent: run a command and wait for it. */
export interface MachinePort {
  exec(body: ExecBody): Promise<ExecResult>;
}

export function createMachine(options: { defaultCwd: string }): MachinePort {
  const shell =
    process.platform === 'win32'
      ? defaultShell(process.env, 'win32')
      : (process.env['SHELL'] ?? '/bin/sh');
  return {
    async exec(body) {
      const cwd = resolveCwd(body.cwd ?? options.defaultCwd, homedir());
      const isDir = await stat(cwd).then(
        (s) => s.isDirectory(),
        () => false,
      );
      if (!isDir) throw invalid(`Not a directory: ${cwd}`);
      return runShell(body.command, { cwd, timeoutSec: body.timeoutSec, env: process.env, shell });
    },
  };
}
