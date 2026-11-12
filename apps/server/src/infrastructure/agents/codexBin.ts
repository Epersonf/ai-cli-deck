import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

export interface CodexBin {
  command: string;
  /** Arguments that come before Codex's own (a script path when it runs under node). */
  prefix: string[];
}

/**
 * Finds Codex without a shell. On Windows npm installs `codex.cmd`, which cannot be spawned directly; its
 * script is run with node instead, so arguments (the briefing has quotes and newlines) arrive untouched.
 */
export function resolveCodex(env: Record<string, string>, platform = process.platform): CodexBin {
  const path = env['PATH'] ?? env['Path'] ?? '';
  for (const dir of path.split(delimiter).filter(Boolean)) {
    if (platform !== 'win32') {
      if (existsSync(join(dir, 'codex'))) return { command: join(dir, 'codex'), prefix: [] };
      continue;
    }
    const exe = join(dir, 'codex.exe');
    if (existsSync(exe)) return { command: exe, prefix: [] };
    if (existsSync(join(dir, 'codex.cmd'))) {
      const script = join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(script)) return { command: process.execPath, prefix: [script] };
      const sibling = join(dirname(dir), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(sibling)) return { command: process.execPath, prefix: [sibling] };
    }
  }
  return { command: 'codex', prefix: [] };
}
