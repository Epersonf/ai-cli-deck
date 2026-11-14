import type { ChatEvent, ChatRetry as State } from '@deck/shared';
import { providerRetry } from '../domain/providerRetry.js';
import type { RetryDeps } from './RetryDeps.js';
import { RetryTask } from './RetryTask.js';
import { RetryTimer } from './RetryTimer.js';
import { retryPlan } from './retryPlan.js';

/** Waiting is opt-in per task; no model requests are made while the timer is waiting. */
export class ChatRetry {
  private value: State | null;
  private readonly task: RetryTask;
  private readonly timer: RetryTimer;
  private armed = false;
  private attempt = 0;
  constructor(private readonly d: RetryDeps) {
    this.value = d.persistence.initial;
    this.task = new RetryTask(d.runner, d.book, d.settings, d.uuid);
    this.timer = new RetryTimer(
      d.persistence.save,
      () => {
        void this.resume();
      },
      () => {
        if (this.value) this.value = { ...this.value, status: 'offered' };
        this.armed = false;
        this.d.changed();
        this.d.book.add({
          t: 'notice',
          level: 'error',
          text: 'Could not save automatic continuation. Choose again after fixing storage.',
        });
      },
    );
  }
  view(): State | null {
    return this.value;
  }

  async restore(): Promise<void> {
    if (!this.value) return;
    await this.d.book.ready();
    if (!this.task.restore(this.value)) {
      this.cancel();
      return;
    }
    this.attempt = this.value.attempt;
    this.d.hold();
    this.d.changed();
    if (this.value.status === 'waiting') {
      this.armed = true;
      await this.timer.write(this.value, true);
    }
  }

  ended(event: Extract<ChatEvent, { t: 'turn-end' }>): boolean {
    if (this.value) return true;
    const hint = event.error
      ? event.retry === undefined
        ? providerRetry(event.error)
        : event.retry
      : null;
    if (!hint) {
      this.armed = false;
      this.attempt = 0;
      this.task.clear();
      return false;
    }
    const sourceId = this.task.capture();
    if (!sourceId) return false;
    this.d.runner.release(true);
    const waiting = this.armed && this.attempt < 5;
    if (!waiting) this.armed = false;
    this.value = {
      id: this.d.uuid(),
      sourceId,
      threadId: this.d.settings.run().fork ? null : this.d.settings.chatId,
      kind: hint.kind,
      status: waiting ? 'waiting' : 'offered',
      attempt: this.attempt,
      ...retryPlan(
        hint,
        this.d.usage(),
        this.attempt,
        Date.now(),
        this.d.settings.view().effectiveModel,
      ),
    };
    this.d.hold();
    this.d.changed();
    void this.timer.write(this.value, waiting);
    return true;
  }

  async choose(id: string, action: 'wait' | 'now' | 'cancel'): Promise<void> {
    if (this.value?.id !== id) return;
    if (action === 'cancel') {
      this.cancel();
      return;
    }
    if (action === 'now') {
      this.value = { ...this.value, attempt: 0 };
      await this.resume();
      return;
    }
    if (this.value.status === 'waiting') return;
    this.armed = true;
    this.attempt = 0;
    const at = Date.parse(this.value.retryAt);
    this.value = {
      ...this.value,
      status: 'waiting',
      attempt: 0,
      retryAt: new Date(Math.max(Date.now() + 1500, at)).toISOString(),
    };
    this.d.changed();
    await this.timer.write(this.value, true);
  }

  private async resume(): Promise<void> {
    if (!this.value) return;
    const state = this.value;
    if (!(await this.timer.write(null))) return;
    this.value = null;
    this.armed = true;
    this.attempt = state.attempt + 1;
    this.d.changed();
    this.d.book.add({ t: 'notice', level: 'info', text: 'Resuming the interrupted task…' });
    if (!this.task.resume()) {
      this.armed = false;
      this.d.release();
    }
  }

  cancel(release = true): void {
    const had = this.value !== null;
    this.value = null;
    this.armed = false;
    this.attempt = 0;
    this.task.clear();
    this.timer.stop();
    if (had) {
      this.d.changed();
      void this.timer.write(null);
    }
    if (release && had) this.d.release();
  }
}
