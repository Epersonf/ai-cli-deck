import process from 'node:process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [variant, ...args] = process.argv.slice(2);
if (process.env.CAPABILITIES_LOG)
  appendFileSync(process.env.CAPABILITIES_LOG, `${JSON.stringify(args)}\n`);
if (args[0] === 'exec') {
  process.stdout.write(
    variant.startsWith('supported')
      ? 'Usage: codex exec fork [OPTIONS]'
      : 'Usage: codex exec [OPTIONS] [PROMPT]',
  );
} else if (variant.startsWith('supported')) {
  const dir = join(args.at(-1), 'v2');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ThreadCompactStartParams.json'), '{}');
  writeFileSync(join(dir, 'ThreadResumeParams.json'), '{}');
} else process.exit(1);
