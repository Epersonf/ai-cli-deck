import type { AgentSink, PermissionAnswer } from '../../../domain/agent.js';
import type { AntigravityRpc } from './antigravityRpc.js';
import { jsonList } from './antigravityMap.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

interface Permission {
  rpcId: unknown;
  options: Json[];
}

/** Preserve the CLI's offered option ids, including allow-always and cancellation. */
export class AntigravityPermissions {
  private readonly pending = new Map<string, Permission>();
  constructor(
    private readonly sink: AgentSink,
    private readonly rpc: () => AntigravityRpc | null,
  ) {}

  request(message: Json): void {
    const params = obj(message['params']) ?? {};
    const call = obj(params['toolCall']) ?? {};
    const options = jsonList(params['options']);
    const id = `agy:permission:${String(message['id'])}`;
    this.pending.set(id, { rpcId: message['id'], options });
    this.sink.event({
      t: 'permission',
      id,
      tool: str(call['title']) || 'tool',
      input: call['rawInput'] ?? call,
      canAlways: options.some((option) => option['kind'] === 'allow_always'),
      reason: null,
    });
  }

  answer(id: string, answer: PermissionAnswer): void {
    const permission = this.pending.get(id);
    if (!permission) return;
    this.pending.delete(id);
    const preferred = answer.allow
      ? answer.always
        ? 'allow_always'
        : 'allow_once'
      : 'reject_once';
    const option =
      permission.options.find((item) => item['kind'] === preferred) ??
      (answer.allow && answer.always
        ? permission.options.find((item) => item['kind'] === 'allow_once')
        : undefined);
    this.rpc()?.respond(permission.rpcId, {
      outcome: option
        ? { outcome: 'selected', optionId: option['optionId'] }
        : { outcome: 'cancelled' },
    });
    this.sink.event({ t: 'permission-done', id, allowed: Boolean(option) && answer.allow });
  }

  cancel(silent = false): void {
    for (const [id, permission] of this.pending) {
      this.rpc()?.respond(permission.rpcId, { outcome: { outcome: 'cancelled' } });
      if (!silent) this.sink.event({ t: 'permission-done', id, allowed: false });
    }
    this.pending.clear();
  }
}
