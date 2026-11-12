import type { ChatFormat } from '@deck/shared';

/** How the first message of a conversation handed over from another AI starts (see ChatActions). */
export const HANDOVER_START = '[deck] This chat continues a conversation the user had with ';

/** Where an agent keeps its saved chats, so the deck can list and read them. */
export interface ChatSupport {
  /** Reader of its chat files. */
  format: ChatFormat;
  /** Its config folder, where the reader finds the chats. */
  home: string;
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

/** Where transcripts handed to another AI live. */
export interface ChatFilesPort {
  /** Saves a transcript inside `cwd` (kept out of git) and returns its path relative to `cwd`. */
  writeTranscript(cwd: string, name: string, text: string): Promise<string>;
}
