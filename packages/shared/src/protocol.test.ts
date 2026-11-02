import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol.js';

describe('parseClientMessage', () => {
  it('parses valid messages', () => {
    expect(parseClientMessage('{"type":"input","data":"ls\\r"}')).toEqual({
      type: 'input',
      data: 'ls\r',
    });
    expect(parseClientMessage('{"type":"resize","cols":80,"rows":24}')?.type).toBe('resize');
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ type: 'ping' });
  });

  it('rejects unknown, malformed and out-of-range messages', () => {
    expect(parseClientMessage('{"type":"nope"}')).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('{"type":"resize","cols":0,"rows":24}')).toBeNull();
    expect(parseClientMessage('{"type":"input"}')).toBeNull();
  });
});
