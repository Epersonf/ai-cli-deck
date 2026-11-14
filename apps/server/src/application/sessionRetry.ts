import { CHAT_META, ChatRetrySchema, type Session } from '@deck/shared';
import type { RetryPersistence } from './RetryDeps.js';
import type { SessionRegistry } from './SessionRegistry.js';
import { withMeta } from './sessionMeta.js';

/** Session metadata holds only a bounded state and references to the provider thread / original input. */
export function sessionRetry(session: Session, reg: SessionRegistry): RetryPersistence {
  let initial: RetryPersistence['initial'] = null;
  try {
    const parsed = ChatRetrySchema.safeParse(JSON.parse(session.meta[CHAT_META.retry] ?? 'null'));
    if (parsed.success) initial = parsed.data;
  } catch {
    /* Old/corrupt metadata cannot authorize automatic work. */
  }
  return {
    initial,
    save: async (state) => {
      const current = reg.runtimes.get(session.id);
      if (!current) return;
      const meta = withMeta(
        current.session.meta,
        CHAT_META.retry,
        state ? JSON.stringify(state) : '',
      );
      reg.update(session.id, { meta });
      await reg.persist();
    },
  };
}
