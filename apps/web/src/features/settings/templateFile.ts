import {
  ProfileTemplateSchema,
  parseJsonc,
  templateProblems,
  type ProfileTemplate,
} from '@deck/shared';

/** The template in a pasted or chosen file, or what is wrong with it (the server checks again). */
export function checkTemplateText(text: string): ProfileTemplate | string {
  let raw: unknown;
  try {
    raw = parseJsonc(text);
  } catch (error) {
    return `Not valid JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
  const parsed = ProfileTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return `Not a profile template: ${issue?.path.join('.') || 'file'} ${issue?.message ?? ''}`.trim();
  }
  const problems = templateProblems(parsed.data);
  return problems.length > 0 ? `Template problem: ${problems.join('; ')}` : parsed.data;
}

interface AndroidBridge {
  saveText(name: string, text: string): void;
}

/** Saves text as a file. Inside the Android app the app's own "save as" picker is used (a WebView cannot download). */
export function downloadText(name: string, text: string): void {
  const bridge = (window as { DeckAndroid?: AndroidBridge }).DeckAndroid;
  if (bridge) return bridge.saveText(name, text);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Puts text on the clipboard. Falls back to the old copy command where the clipboard API is missing (plain http). */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // no clipboard API in this context: use a hidden text box
  }
  const box = document.createElement('textarea');
  box.value = text;
  box.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(box);
  box.select();
  const copied = document.execCommand('copy');
  box.remove();
  if (!copied) throw new Error('Copy is not available here: use Download instead');
}
