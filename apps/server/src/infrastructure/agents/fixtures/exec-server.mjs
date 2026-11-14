import process from 'node:process';
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
let text = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  text += chunk;
});
process.stdin.on('end', () => {
  if (process.env.EXEC_LOG)
    appendFileSync(process.env.EXEC_LOG, `${JSON.stringify({ args, text })}\n`);
  const id =
    args[1] === 'fork' ? 'forked-thread' : args[1] === 'resume' ? args[2] : 'initial-thread';
  process.stdout.write(`${JSON.stringify({ type: 'thread.started', thread_id: id })}\n`);
  process.stdout.write(
    `${JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 10 } })}\n`,
  );
});
