/** A tool call as the chat shows it in one line. */
export interface ToolSummary {
  /** A short mark for the kind of tool. */
  icon: ToolKind;
  /** What it does, in the tool's own words (the command, the file...). */
  title: string;
}

const asRecord = (input: unknown): Record<string, unknown> =>
  typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

const text = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(String).join(' ');
  return '';
};

const firstText = (input: Record<string, unknown>, keys: readonly string[]): string => {
  for (const key of keys) {
    const value = text(input[key]);
    if (value !== '') return value;
  }
  return '';
};

export type ToolKind = 'shell' | 'edit' | 'read' | 'search' | 'web' | 'task' | 'todo' | 'other';

const KIND: readonly [RegExp, ToolKind][] = [
  [/^(bash|shell|command|exec|local_shell)/i, 'shell'],
  [/^(edit|multiedit|write|notebookedit|apply_patch|patch|file_change)/i, 'edit'],
  [/^(read|view|cat)/i, 'read'],
  [/^(glob|grep|search|find|ls)/i, 'search'],
  [/^(web|fetch|browse)/i, 'web'],
  [/^(task|agent)/i, 'task'],
  [/^todo/i, 'todo'],
];

export const iconFor = (name: string): ToolKind =>
  KIND.find(([re]) => re.test(name))?.[1] ?? 'other';

const PRIMARY = [
  'command',
  'cmd',
  'file_path',
  'path',
  'notebook_path',
  'pattern',
  'url',
  'query',
  'description',
  'prompt',
] as const;

export function summarize(name: string, input: unknown): ToolSummary {
  const record = asRecord(input);
  const main = firstText(record, PRIMARY).replace(/\s+/g, ' ').trim();
  return { icon: iconFor(name), title: main.slice(0, 160) };
}

/** An edit as before/after text: the diff-ish view of Edit, MultiEdit, Write and patches. */
export interface EditPart {
  before: string;
  after: string;
}

export function editParts(name: string, input: unknown): EditPart[] {
  const record = asRecord(input);
  if (Array.isArray(record['edits'])) {
    return record['edits'].map((e) => {
      const edit = asRecord(e);
      return { before: text(edit['old_string']), after: text(edit['new_string']) };
    });
  }
  if ('old_string' in record || 'new_string' in record) {
    return [{ before: text(record['old_string']), after: text(record['new_string']) }];
  }
  if (/^write/i.test(name) && 'content' in record) {
    return [{ before: '', after: text(record['content']) }];
  }
  const patch = firstText(record, ['patch', 'diff', 'input']);
  return patch === '' ? [] : [{ before: '', after: patch }];
}

/** The whole input as readable text (shown when a tool has nothing better than its raw input). */
export function inputText(input: unknown): string {
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input, null, 2) ?? '';
  } catch {
    return '';
  }
}
