export interface Attachment {
  mediaType: string;
  name: string | null;
}

/** What the chat draws: the conversation's events folded into rows. */
export type Block =
  | { kind: 'user'; id: string; text: string; attachments: Attachment[] }
  | { kind: 'text' | 'thinking'; id: string; text: string; streaming: boolean }
  | {
      kind: 'tool';
      id: string;
      name: string;
      input: unknown;
      result: { output: string; isError: boolean } | null;
    }
  | {
      kind: 'permission';
      id: string;
      tool: string;
      input: unknown;
      canAlways: boolean;
      reason: string | null;
      state: 'pending' | 'allowed' | 'denied';
    }
  | { kind: 'notice'; id: string; level: 'info' | 'error'; text: string }
  | {
      kind: 'turn';
      id: string;
      error: string | null;
      costUsd: number | null;
      durationMs: number | null;
    };

export interface PartialText {
  id: string;
  kind: 'text' | 'thinking';
  text: string;
}
