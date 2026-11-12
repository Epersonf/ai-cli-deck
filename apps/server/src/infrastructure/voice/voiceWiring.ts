import { join } from 'node:path';
import { WhisperEngine } from './WhisperEngine.js';

/** Speech to text on this machine, its model kept under the state folder. */
export const createVoice = (stateDir: string): WhisperEngine =>
  new WhisperEngine({
    dir: join(stateDir, 'voice'),
    platform: process.platform,
    arch: process.arch,
    env: process.env,
  });
