import type { ChatEvent } from '@deck/shared';
import { obj, str, type Json } from './codexJson.js';
import type { CodexState } from './codexState.js';

export interface WebTool {
  name: string;
  input: Json;
}

/** Exec has legacy query and structured action variants; absence does not prove an empty search. */
function webTool(item: Json): WebTool {
  const action = obj(item['action']);
  const kind = str(action?.['type']);
  if (['open_page', 'openPage', 'find_in_page', 'findInPage'].includes(kind)) {
    const input: Json = {};
    for (const key of ['url', 'pattern']) if (str(action?.[key])) input[key] = action?.[key];
    return { name: kind.startsWith('open') ? 'web_open' : 'web_find', input };
  }
  const raw = action?.['queries'] ?? item['queries'];
  const queries = Array.isArray(raw)
    ? raw.filter((q): q is string => typeof q === 'string' && q.trim() !== '')
    : [];
  const query = str(action?.['query']).trim() || str(item['query']).trim();
  return {
    name: 'web_search',
    input: queries.length > 0 ? { queries } : query ? { query } : { details: 'not_reported' },
  };
}

/** Refresh the same card when details arrive later; partial notifications never erase known input. */
export function codexWebEvents(
  type: string,
  item: Json,
  id: string,
  state: CodexState,
): ChatEvent[] {
  const previous = state.webTools.get(id);
  let next = webTool(item);
  if (previous && next.input['details'] === 'not_reported') next = previous;
  if (previous?.name === next.name) {
    const known = Object.fromEntries(
      Object.entries(previous.input).filter(([key]) => key !== 'details'),
    );
    const fresh = Object.fromEntries(
      Object.entries(next.input).filter(([key]) => key !== 'details'),
    );
    if (fresh['queries']) delete known['query'];
    if (fresh['query']) delete known['queries'];
    const input = { ...known, ...fresh };
    next = { name: next.name, input: Object.keys(input).length ? input : next.input };
  }
  const out: ChatEvent[] = [];
  if (!previous || JSON.stringify(previous) !== JSON.stringify(next)) {
    state.webTools.set(id, next);
    state.started.add(id);
    out.push({ t: 'tool', id, ...next });
  }
  if (type === 'item.completed') {
    out.push({ t: 'tool-result', id, output: '', isError: item['status'] === 'failed' });
  }
  return out;
}
