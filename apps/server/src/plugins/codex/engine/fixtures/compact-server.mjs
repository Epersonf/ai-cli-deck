import { setTimeout } from 'node:timers';
import process from 'node:process';
// Local protocol peer for integration tests. Never connects to a model or an account.
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (process.env.COMPACT_LOG) appendFileSync(process.env.COMPACT_LOG, `${line}\n`);
  if (message.id === 1) send({ id: 1, result: {} });
  else if (message.id === 2) {
    if (process.env.COMPACT_MODE === 'error')
      send({ id: 2, error: { code: -1, message: '401 Unauthorized' } });
    else send({ id: 2, result: { thread: { id: message.params.threadId } } });
  } else if (message.id === 3) {
    send({ id: 3, result: {} });
    if (process.env.COMPACT_MODE === 'exit') process.exit(1);
    if (process.env.COMPACT_MODE === 'hang') return;
    send({
      method: 'turn/completed',
      params: { threadId: 'other', turn: { status: 'completed' } },
    });
    setTimeout(() => {
      const threadId = message.params.threadId;
      if (process.env.COMPACT_LOG)
        appendFileSync(
          process.env.COMPACT_LOG,
          `${JSON.stringify({ notification: 'completed' })}\n`,
        );
      if (process.env.COMPACT_MODE === 'retry')
        send({
          method: 'error',
          params: { threadId, willRetry: true, error: { message: 'Retry' } },
        });
      send({ method: 'item/completed', params: { threadId, item: { type: 'contextCompaction' } } });
      send({
        method: 'turn/completed',
        params: {
          threadId,
          turn: {
            status: process.env.COMPACT_MODE === 'failed' ? 'failed' : 'completed',
            error: { message: 'Compaction failed at provider' },
          },
        },
      });
    }, 30);
  }
});
