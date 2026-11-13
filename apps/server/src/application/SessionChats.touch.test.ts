import { describe, expect, it, vi } from 'vitest';
import { SessionChats } from './SessionChats.js';
import type { SessionRegistry } from './SessionRegistry.js';

function setup() {
  const update = vi.fn();
  const persist = vi.fn().mockResolvedValue(undefined);
  const send = vi.fn().mockResolvedValue(undefined);
  const sendOrQueue = vi.fn().mockResolvedValue(undefined);
  const reg = {
    update,
    persist,
    rootOf: (id: string) => (id === 'side' ? 'main' : id),
    require: () => ({ chat: { send, queue: { sendOrQueue } } }),
  } as unknown as SessionRegistry;
  return { chats: new SessionChats(reg), update, send, sendOrQueue };
}

describe('SessionChats message order stamp', () => {
  it('stamps the session when a message is sent', async () => {
    const { chats, update, send } = setup();
    await chats.send('main', 'hi');
    expect(update).toHaveBeenCalledWith('main', { lastMessageAt: expect.any(String) });
    expect(send).toHaveBeenCalledWith('hi', []);
  });

  it('stamps when the message is queued behind a running turn', async () => {
    const { chats, update, sendOrQueue } = setup();
    await chats.sendOrQueue('main', 'later');
    expect(update).toHaveBeenCalledTimes(1);
    expect(sendOrQueue).toHaveBeenCalled();
  });

  it('moves the main session up when the message goes to its side chat', async () => {
    const { chats, update } = setup();
    await chats.send('side', 'hi');
    expect(update).toHaveBeenCalledWith('main', expect.anything());
  });
});
