import { randomBytes } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import type { SystemPort } from '../../domain/ports.js';

export class SystemAdapter implements SystemPort {
  homeDir(): string {
    return homedir();
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
  }

  newId(): string {
    return randomBytes(4).toString('hex');
  }

  now(): Date {
    return new Date();
  }
}
