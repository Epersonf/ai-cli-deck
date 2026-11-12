import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol.js';

describe('parseClientMessage', () => {
  it('parses valid messages', () => {
    expect(parseClientMessage('{"type":"send","text":"hi"}')).toEqual({
      type: 'send',
      text: 'hi',
      images: [],
    });
    expect(parseClientMessage('{"type":"permission","id":"p1","allow":true}')?.type).toBe(
      'permission',
    );
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ type: 'ping' });
  });

  it('rejects unknown, malformed and out-of-range messages', () => {
    expect(parseClientMessage('{"type":"nope"}')).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('{"type":"config","mode":"yolo"}')).toBeNull();
    expect(parseClientMessage('{"type":"send"}')).toBeNull();
  });
});
