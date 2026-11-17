import type {
  AgentConfig,
  AgentRun,
  AgentSink,
  AgentSpec,
  PermissionAnswer,
  UserInput,
} from '../../../domain/agent.js';
import { markAuth } from '../../../domain/authError.js';
import { GrokSession } from './grokSession.js';
import { AntigravityPermissions } from '../../antigravity/engine/antigravityPermissions.js';
import { AntigravityMap } from '../../antigravity/engine/antigravityMap.js';
import { grokPromptUsage } from './grokUsage.js';
import { grokAutoAnswer } from './grokPolicy.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

/** Persistent official `grok agent stdio` process, with late callbacks fenced after shutdown. */
export class GrokRun implements AgentRun {
  private readonly session: GrokSession;
  private readonly permissions: AntigravityPermissions;
  private config: AgentConfig;
  private map: AntigravityMap | null = null;
  private closed = false;
  private busy = false;
  private acceptingUpdates = false;
  private stopped = false;
  private cost = 0;
  private cancelTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    spec: AgentSpec,
    private readonly sink: AgentSink,
  ) {
    this.session = new GrokSession(spec, sink);
    this.permissions = new AntigravityPermissions(sink, () => this.session.rpc, 'grok');
    this.config = { model: spec.model, mode: spec.mode, effort: spec.effort };
  }
  send(input: UserInput): void {
    if (this.closed || this.busy) return;
    this.busy = true;
    this.stopped = false;
    this.map = new AntigravityMap(input.id, this.sink);
    void this.turn(input);
  }
  private async turn(input: UserInput): Promise<void> {
    try {
      const session = this.session;
      await session.open(
        (message) => this.receive(message),
        (error) => this.terminate(error.message),
      );
      if (this.closed || this.stopped) return;
      if (!session.rpc || !session.id) throw new Error('Grok Build is not connected');
      await session.config.apply(session.rpc, session.id, { ...this.config });
      if (this.closed || this.stopped) return;
      this.acceptingUpdates = true;
      const response = await session.prompt(input);
      const reason = str(response['stopReason']);
      const spent = grokPromptUsage(response, input.id, session.config.contextWindow());
      this.cost += spent?.costUsd ?? 0;
      if (spent) this.sink.usage({ ...spent.reading, costUsd: this.cost });
      this.finish(
        !this.stopped && reason && !['end_turn', 'cancelled'].includes(reason)
          ? `Grok Build stopped: ${reason}`
          : null,
      );
    } catch (error) {
      this.terminate(
        this.stopped ? null : error instanceof Error ? error.message : 'Grok Build failed',
      );
    }
  }
  private receive(message: Json): void {
    if (this.closed) return;
    const params = obj(message['params']) ?? {};
    if (message['method'] === 'session/update') {
      if (params['sessionId'] !== this.session.id) return;
      const update = obj(params['update']);
      if (!update) return;
      if (update['sessionUpdate'] === 'config_option_update') this.session.config.read(update);
      if (this.acceptingUpdates && !this.stopped) this.map?.update(update);
    } else if (message['method'] === 'session/request_permission') {
      if (!this.acceptingUpdates || this.stopped || params['sessionId'] !== this.session.id) {
        this.session.rpc?.respond(message['id'], { outcome: { outcome: 'cancelled' } });
        return;
      }
      const auto = grokAutoAnswer(this.config.mode, params);
      if (auto) return this.session.rpc?.respond(message['id'], auto);
      this.map?.flush();
      this.permissions.request(message);
    } else if (message['id'] !== undefined) this.session.rpc?.unsupported(message['id']);
  }
  answer(id: string, answer: PermissionAnswer): void {
    this.permissions.answer(id, answer);
  }
  private finish(error: string | null): void {
    if (this.closed || !this.busy) return;
    this.resetTurn();
    this.sink.event({ t: 'turn-end', error, costUsd: null, durationMs: null });
  }
  /** Release failed runs before turn-end can dispatch a queued message into a fresh run. */
  private terminate(error: string | null): void {
    if (this.closed) return;
    const wasBusy = this.busy;
    this.resetTurn();
    this.close();
    this.sink.ended();
    if (wasBusy)
      this.sink.event({
        t: 'turn-end',
        error: error ? markAuth(error) : null,
        costUsd: null,
        durationMs: null,
      });
  }
  private resetTurn(): void {
    if (this.cancelTimer) clearTimeout(this.cancelTimer);
    this.cancelTimer = null;
    this.map?.flush();
    this.map = null;
    this.permissions.cancel();
    this.busy = false;
    this.acceptingUpdates = false;
  }
  interrupt(): void {
    if (this.closed || !this.busy) return;
    this.stopped = true;
    this.permissions.cancel();
    if (!this.session.id) {
      this.terminate(null);
      return;
    }
    this.session.rpc?.notify('session/cancel', { sessionId: this.session.id });
    this.cancelTimer = setTimeout(() => this.terminate(null), 3000);
    this.cancelTimer.unref();
  }
  setConfig(patch: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...patch };
  }
  stopTask(): void {} // ACP has no standard background-task cancellation.
  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.cancelTimer) clearTimeout(this.cancelTimer);
    this.permissions.cancel(true);
    this.session.rpc?.close();
  }
}
