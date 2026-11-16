import process from 'node:process';
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';

const send = (message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
const update = (update) =>
  send({ method: 'session/update', params: { sessionId: 'agy-chat', update } });
const configOptions = [
  {
    id: 'model',
    category: 'model',
    currentValue: 'model-a',
    options: [
      { value: 'model-a', name: 'Model A' },
      { value: 'model-b', name: 'Model B' },
    ],
  },
  {
    id: 'thinking',
    category: 'thought_level',
    currentValue: 'medium',
    options: [
      { value: 'medium', name: 'Medium' },
      { value: 'extra', name: 'Extra' },
    ],
  },
];
let pendingPrompt = null;
let initialized = false;
createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (process.env.AGY_TEST_LOG) appendFileSync(process.env.AGY_TEST_LOG, `${line}\n`);
  const { id, method, params } = message;
  const reply = (result) => send({ id, result });
  if (method === 'initialize') {
    initialized = true;
    reply({
      protocolVersion: 1,
      authMethods: process.env.AGY_TEST_NO_KEY_AUTH ? [] : [{ id: 'gemini-api-key' }],
      agentCapabilities: {
        promptCapabilities: { image: !process.env.AGY_TEST_NO_IMAGES },
        mcpCapabilities: { http: true },
        loadSession: true,
        sessionCapabilities: process.env.AGY_TEST_LOAD ? {} : { resume: {} },
      },
    });
  } else if (method === 'authenticate') {
    reply({});
  } else if (!initialized) {
    send({ id, error: { code: -32600, message: 'not initialized' } });
  } else if (['session/new', 'session/resume', 'session/load'].includes(method)) {
    if (process.env.AGY_TEST_AUTH_ERROR) {
      send({ id, error: { code: -32000, message: 'Authentication required' } });
      return;
    }
    if (method === 'session/load')
      update({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'old history' },
      });
    reply({
      sessionId: 'agy-chat',
      configOptions,
      modes: { availableModes: [{ id: 'default' }, { id: 'accept-edits' }, { id: 'plan' }] },
    });
  } else if (method === 'session/set_mode') reply({});
  else if (method === 'session/set_config_option') reply({ configOptions });
  else if (method === 'session/prompt') {
    const text = params.prompt.map((part) => part.text ?? '').join('\n');
    if (text.endsWith('crash')) {
      process.stderr.write('CLI crashed');
      process.exit(1);
    }
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
          sessionId: 'agy-chat',
          toolCall: { toolCallId: 'call', title: 'Write a file', rawInput: { path: 'test.txt' } },
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
    update({ sessionUpdate: 'usage_update', used: 1200, size: 1048576, cost: 0.05 });
    reply({
      stopReason: 'end_turn',
      usage: {
        inputTokens: 1000,
        outputTokens: 200,
        thoughtTokens: 50,
        cachedReadTokens: 400,
        cachedWriteTokens: 100,
        totalTokens: 1250,
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
