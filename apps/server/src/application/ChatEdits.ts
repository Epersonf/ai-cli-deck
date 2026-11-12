import type { ChatBook } from './ChatBook.js';
import { planRewind } from './chatRewind.js';
import type { ChatSettings } from './ChatSettings.js';
import type { RuntimeDeps } from './ChatRuntime.js';

/** Changes what the conversation is: back to before an edited message, or all the way to a new one. */
export class ChatEdits {
  constructor(
    private readonly d: RuntimeDeps,
    private readonly book: ChatBook,
    private readonly settings: ChatSettings,
  ) {}

  /** Goes back to just before the user message `userId`; returns what the agent is told in place of `text`. */
  async goBack(userId: string, text: string, revertFiles: boolean): Promise<string> {
    const { d, book, settings } = this;
    const plan = await planRewind(d.agent, {
      events: book.all(),
      userId,
      text,
      revertFiles,
      chatId: settings.chatId,
      spec: d.spec(settings.run()),
      label: d.info.label,
      now: d.now(),
    });
    settings.goBack(plan.back);
    if (!plan.back) d.remember({ chatId: '' });
    await this.show(plan.kept);
    return plan.prompt;
  }

  /** The conversation becomes `events` and every device is told. */
  private async show(events: Parameters<ChatBook['replace']>[0]): Promise<void> {
    this.d.meter.reset();
    await this.book.replace(events);
    this.d.bus.publish({ kind: 'reset', sessionId: this.d.id, events: [...events] });
  }

  async startOver(): Promise<void> {
    this.settings.startOver();
    this.d.remember({ chatId: '' });
    await this.show([]);
  }
}
