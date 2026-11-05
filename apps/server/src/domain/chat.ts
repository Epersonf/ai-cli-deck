import type { ChatFormat } from '@deck/shared';

/** How the first message of a conversation handed over from another AI starts (see ChatActions). */
export const HANDOVER_START = '[deck] This chat continues a conversation the user had with ';

/** What a CLI offers for its conversations, for one profile. Every part is optional. */
export interface ChatSupport {
  /** Reader of its chat files; null when the deck cannot read them (the terminal's text is used instead). */
  format: ChatFormat | null;
  /** Its config folder, where the reader finds the chats. */
  home: string | null;
  resume: ((chatId: string) => string[]) | null;
  fork: ((chatId: string) => string[]) | null;
  /** Continues the CLI's latest chat in this folder, when the id is not known. */
  last: string[] | null;
  /** Starts a new chat whose first message is `text`; null: the deck types the message instead. */
  prompt: ((text: string) => string[]) | null;
  /** Extra arguments that make the CLI tell the deck which chat it is on (written to $DECK_CHAT_FILE). */
  track: string[];
}

/** A conversation as the CLI saved it. */
export interface ChatEntry {
  id: string;
  path: string;
  /** Its first request, shortened. */
  title: string;
  startedAt: Date;
  updatedAt: Date;
}

/** One step of a conversation, in no CLI's format. */
export interface ChatTurn {
  role: 'user' | 'assistant' | 'tool';
  text: string;
}

/** Reads one CLI's chat files. */
export interface ChatReader {
  /** The chats kept for `cwd`, newest first. */
  list(home: string, cwd: string): Promise<ChatEntry[]>;
  read(entry: ChatEntry): Promise<ChatTurn[]>;
}

/** Where chat notes live on disk: what a CLI reported, and transcripts handed to another one. */
export interface ChatFilesPort {
  /** The chat the CLI of `sessionId` last reported ($DECK_CHAT_FILE), if it reports at all. */
  reported(sessionId: string): Promise<{ id: string; path: string } | null>;
  /** The file a session's CLI reports its chat to. */
  reportFile(sessionId: string): string;
  /** Drops what an earlier run reported (a restarted terminal may run another CLI). */
  forget(sessionId: string): Promise<void>;
  /** Saves a transcript inside `cwd` (kept out of git) and returns its path relative to `cwd`. */
  writeTranscript(cwd: string, name: string, text: string): Promise<string>;
}
