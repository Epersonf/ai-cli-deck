import process from 'node:process';
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';

const send = (message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
const update = (update) =>
  send({ method: 'session/update', params: { sessionId: 'grok-chat', update } });
const configOptions = [
  {
    id: 'model',
    category: 'model',
    currentValue: 'grok-4.7',
    options: [{ value: 'grok-4.7' }, { value: 'grok-4.5' }],
  },
  {
    id: 'reasoning_effort',
    category: 'thought_level',
    currentValue: 'high',
    options: [{ value: 'low' }, { value: 'medium' }, { value: 'high' }, { value: 'xhigh' }],
  },
];
let pendingPrompt = null;
let initialized = false;
createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (process.env.GROK_TEST_LOG) appendFileSync(process.env.GROK_TEST_LOG, `${line}\n`);
  const { id, method, params } = message;
  const reply = (result) => send({ id, result });
  if (method === 'initialize') {
    initialized = true;
    reply({
      protocolVersion: 1,
      authMethods: [{ id: 'grok.com', name: 'Grok' }],
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: { image: !process.env.GROK_TEST_NO_IMAGES },
        mcpCapabilities: { http: true },
        sessionCapabilities: { resume: {}, close: {} },
      },
    });
  } else if (!initialized) {
    send({ id, error: { code: -32600, message: 'not initialized' } });
  } else if (['session/new', 'session/resume', 'session/load'].includes(method)) {
    if (process.env.GROK_TEST_AUTH_ERROR) {
      send({ id, error: { code: -32000, message: 'Authentication required' } });
      return;
    }
    reply({
      sessionId: 'grok-chat',
      models: {
        currentModelId: 'grok-4.7',
        availableModels: [
          { modelId: 'grok-4.7', name: 'Grok 4.7', _meta: { totalContextTokens: 256000 } },
          { modelId: 'grok-4.5', name: 'Grok 4.5', _meta: { totalContextTokens: 500000 } },
        ],
      },
      configOptions,
    });
  } else if (method === 'session/set_config_option') {
    const option = configOptions.find((item) => item.id === params.configId);
    if (option) option.currentValue = params.value;
    reply({ configOptions });
  } else if (method === 'session/set_model') reply({});
  else if (method === 'session/close') reply({});
  else if (method === 'session/prompt') {
    const text = params.prompt.map((part) => part.text ?? '').join('\n');
    if (text.endsWith('wait')) {
      pendingPrompt = id;
      return;
    }
    if (text.endsWith('permission')) {
      pendingPrompt = id;
      send({
        id: 'permission-1',
        method: 'session/request_permission',
        params: {
          sessionId: 'grok-chat',
          toolCall: {
            toolCallId: 'call',
            title: 'Run command',
            kind: text.includes('edit') ? 'edit' : 'execute',
            rawInput: { command: 'ls' },
          },
          options: [
            { optionId: 'once', kind: 'allow_once' },
            { optionId: 'always', kind: 'allow_always' },
            { optionId: 'deny', kind: 'reject_once' },
          ],
        },
      });
      return;
    }
    update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Thinking' } });
    update({
      sessionUpdate: 'tool_call',
      toolCallId: 'read',
      title: 'Read',
      status: 'in_progress',
      rawInput: { path: 'test.txt' },
    });
    update({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'read',
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: 'file content' } }],
    });
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello ' } });
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'world' } });
    update({ sessionUpdate: 'usage_update', used: 1200, size: 500000 });
    reply({
      stopReason: 'end_turn',
      _meta: {
        usage: {
          inputTokens: 3000,
          outputTokens: 40,
          cachedReadTokens: 1000,
          cacheCreationTokens: 5,
          modelCalls: 2,
          apiDurationMs: 1500,
          costUsdTicks: 266020000,
        },
      },
    });
  } else if (method === 'session/cancel') {
    if (pendingPrompt !== null) send({ id: pendingPrompt, result: { stopReason: 'cancelled' } });
    pendingPrompt = null;
  } else if (id === 'permission-1') {
    if (message.result?.outcome?.outcome === 'cancelled') return;
    send({ id: pendingPrompt, result: { stopReason: 'end_turn' } });
    pendingPrompt = null;
  } else if (id !== undefined) send({ id, error: { code: -32601, message: 'unsupported' } });
});
