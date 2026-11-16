import type { AgentSink, AgentSpec, UserInput } from '../../../domain/agent.js';
import { AntigravityRpc } from './antigravityRpc.js';
import { AntigravityConfig } from './antigravityConfig.js';
import { jsonList } from './antigravityMap.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

/** Negotiate the official CLI's ACP capabilities and restore its saved conversation. */
export class AntigravitySession {
  rpc: AntigravityRpc | null = null;
  id: string | null;
  readonly config: AntigravityConfig;
  private capabilities: Json = {};
  private ready: Promise<void> | null = null;
  private briefingPending: boolean;

  constructor(
    private readonly spec: AgentSpec,
    private readonly sink: AgentSink,
  ) {
    this.id = spec.resumeId;
    this.briefingPending = !spec.resumeId;
    this.config = new AntigravityConfig(sink);
  }

  open(receive: (message: Json) => void, ended: (error: Error) => void): Promise<void> {
    return (this.ready ??= this.initialize(receive, ended));
  }

  private async initialize(
    receive: (message: Json) => void,
    ended: (error: Error) => void,
  ): Promise<void> {
    if (this.spec.fork)
      throw new Error(
        'Antigravity does not support native forks; continue using a transcript instead',
      );
    const rpc = new AntigravityRpc(this.spec.cwd, this.spec.env, receive, ended);
    this.rpc = rpc;
    const initialized = await rpc.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'ai-cli-deck', version: '0.1.0' },
    });
    if (initialized['protocolVersion'] !== 1)
      throw new Error('Antigravity must support ACP protocol version 1');
    this.capabilities = obj(initialized['agentCapabilities']) ?? {};
    if (this.spec.env['GEMINI_API_KEY']) {
      if (!jsonList(initialized['authMethods']).some((method) => method['id'] === 'gemini-api-key'))
        throw new Error(
          'This Antigravity CLI does not support Gemini API key authentication over ACP. Update agy.',
        );
      await rpc.request('authenticate', { methodId: 'gemini-api-key' });
    }
    const sessions = obj(this.capabilities['sessionCapabilities']);
    const params: Json = { cwd: this.spec.cwd, mcpServers: [] };
    if (obj(this.capabilities['mcpCapabilities'])?.['http'] === true)
      params['mcpServers'] = [{ type: 'http', name: 'deck', url: this.spec.mcpUrl, headers: [] }];
    if (sessions?.['systemPrompt']) {
      params['systemPrompt'] = {
        mode: 'append',
        content: [{ type: 'text', text: this.spec.guide }],
      };
      this.briefingPending = false;
    }
    let response: Json;
    if (this.id) {
      params['sessionId'] = this.id;
      if (sessions?.['resume']) response = await rpc.request('session/resume', params);
      else if (this.capabilities['loadSession'] === true)
        response = await rpc.request('session/load', params);
      else
        throw new Error(
          'This Antigravity CLI cannot resume saved sessions. Update agy to version 1.5 or later.',
        );
    } else {
      response = await rpc.request('session/new', params);
      this.id = str(response['sessionId']) || null;
    }
    if (!this.id) throw new Error('Antigravity returned no session id');
    this.config.read(response);
    this.sink.chatId(this.id);
  }

  async prompt(input: UserInput): Promise<Json> {
    const rpc = this.rpc;
    if (!rpc || !this.id) throw new Error('Antigravity is not connected');
    const capabilities = obj(this.capabilities['promptCapabilities']);
    if (input.images.length && capabilities?.['image'] !== true)
      throw new Error('This Antigravity CLI does not support image attachments');
    if (input.images.some((image) => !image.mediaType.startsWith('image/')))
      throw new Error('Antigravity supports image attachments only');
    const prompt: Json[] = [];
    if (this.briefingPending)
      prompt.push({
        type: 'text',
        text: `[ai-cli-deck instructions]\n${this.spec.guide}\n[/ai-cli-deck instructions]`,
      });
    prompt.push({ type: 'text', text: input.text });
    for (const image of input.images)
      prompt.push({ type: 'image', data: image.data, mimeType: image.mediaType });
    const response = await rpc.request('session/prompt', { sessionId: this.id, prompt }, 0);
    this.briefingPending = false;
    return response;
  }
}
