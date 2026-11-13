import { draftOf, useDraft } from './draftStore';

/** A chat's draft as `[text, setText]`; `setText` also takes a function of the current text. */
export function useDraftText(
  sessionId: string,
): [string, (value: string | ((now: string) => string)) => void] {
  const text = useDraft(draftOf(sessionId));
  const setText = (value: string | ((now: string) => string)): void => {
    const now = useDraft.getState().byId[sessionId] ?? '';
    useDraft.getState().set(sessionId, typeof value === 'function' ? value(now) : value);
  };
  return [text, setText];
}
