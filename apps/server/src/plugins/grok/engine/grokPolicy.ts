import type { PermissionMode } from '@deck/shared';
import { jsonList } from '../../antigravity/engine/antigravityMap.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

/**
 * Grok Build has no permission modes over ACP (only `/always-approve`), so the Deck applies them: it asks
 * the person by default, approves file edits in acceptEdits, and approves everything in bypassPermissions.
 * Returns the answer to send, or null to ask the person.
 */
export function grokAutoAnswer(mode: PermissionMode, params: Json): Json | null {
  if (mode !== 'acceptEdits' && mode !== 'bypassPermissions') return null;
  const kind = str(obj(params['toolCall'])?.['kind']);
  if (mode === 'acceptEdits' && kind !== 'edit') return null;
  const allow = jsonList(params['options']).find((option) => option['kind'] === 'allow_once');
  return allow ? { outcome: { outcome: 'selected', optionId: str(allow['optionId']) } } : null;
}
