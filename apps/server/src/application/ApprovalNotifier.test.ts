import { describe, expect, it, vi } from 'vitest';
import type { ApprovalRequest } from '@deck/shared';
import { ApprovalNotifier } from './ApprovalNotifier';

const request: ApprovalRequest = {
  id: 'r1',
  sessionId: 's1',
  kind: 'worktree',
  reason: 'needs isolation',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  resultPath: null,
};

function setup(watched = true) {
  const sent: { body: { actions: { label: string; url: string }[] } }[] = [];
  const decide = vi.fn().mockResolvedValue(request);
  let clock = 0;
  let listener: (event: unknown) => void = () => undefined;
  const notifier = new ApprovalNotifier({
    approvals: { decide } as never,
    bus: { subscribe: (fn: (event: unknown) => void) => (listener = fn) } as never,
    phone: {
      request: (_m: string, _p: string, body: never) => (sent.push({ body }), Promise.resolve()),
    },
    watched: () => watched,
    label: () => 'Work',
    baseUrl: 'http://127.0.0.1:1',
    now: () => clock,
  });
  notifier.start();
  const ask = async () => {
    listener({ kind: 'approval', request });
    await new Promise((r) => setTimeout(r, 0));
  };
  return { notifier, sent, decide, ask, tick: (ms: number) => (clock += ms) };
}

const tokenOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);

function buttons(sent: { body: { actions: { label: string; url: string }[] } }[]) {
  const [approve, reject] = sent[0]?.body.actions ?? [];
  if (!approve || !reject) throw new Error('no buttons were sent');
  return {
    approve: { ...approve, token: tokenOf(approve.url) },
    reject: { ...reject, token: tokenOf(reject.url) },
  };
}

describe('ApprovalNotifier', () => {
  it('sends Approve and Reject, and a button works once for the whole request', async () => {
    const { notifier, sent, decide, ask } = setup();
    await ask();
    const { approve, reject } = buttons(sent);
    expect(approve.label).toBe('Approve');
    expect(await notifier.press(approve.token)).toBe(true);
    expect(decide).toHaveBeenCalledWith('r1', 'approve');
    expect(await notifier.press(approve.token)).toBe(false);
    expect(await notifier.press(reject.token)).toBe(false);
  });

  it('says nothing for a terminal nobody asked to watch, and buttons expire', async () => {
    const quiet = setup(false);
    await quiet.ask();
    expect(quiet.sent).toHaveLength(0);

    const { notifier, sent, ask, tick } = setup();
    await ask();
    tick(31 * 60_000);
    expect(await notifier.press(buttons(sent).approve.token)).toBe(false);
  });
});
