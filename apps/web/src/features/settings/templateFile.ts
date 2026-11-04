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

/** Saves text as a file through the browser. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Puts text on the clipboard (where saving a file is not possible, e.g. some in-app browsers). */
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
