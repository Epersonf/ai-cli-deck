interface SizedTerminal {
  cols: number;
  rows: number;
  resize(cols: number, rows: number): void;
}

export interface SizeSync {
  readonly following: boolean;
  /** This device takes over: fit to its own window and tell the server (everyone else then mirrors it). */
  claim(): void;
  /** Re-fit after the window changed. A mirroring device keeps the owner's size instead. */
  fit(): void;
  /** Tell the server our size, unless we are mirroring someone else's. */
  sendIfOwner(): void;
  /** The server's size changed: if it is not ours, mirror it. */
  onServerSize(cols: number, rows: number): void;
}

export interface Fitter {
  /** Fits rows and columns to this device's window, at the normal font size. */
  fit(): void;
  /** Keeps the rows and columns and shrinks the font until they fit this device's window. */
  mirror(): void;
  /** The rows and columns `fit` would choose (undefined while the terminal is not on screen). */
  propose(): { cols: number; rows: number } | undefined;
}

/**
 * One terminal, several devices (say a phone and a PC): the program has a single size, so the last device
 * you used sets it and the others show the same rows and columns in a smaller font, whole and without a
 * scrollbar of their own. Using a mirroring device (typing, tapping, focusing it) takes the size over.
 */
export function createSizeSync(
  term: SizedTerminal,
  fitter: Fitter,
  send: (cols: number, rows: number) => void,
  onFollowing: (following: boolean) => void,
): SizeSync {
  let following = false;
  const setFollowing = (value: boolean): void => {
    if (value === following) return;
    following = value;
    onFollowing(value);
  };
  return {
    get following() {
      return following;
    },
    claim() {
      setFollowing(false);
      fitter.fit();
      send(term.cols, term.rows);
    },
    fit() {
      if (following) fitter.mirror();
      else fitter.fit();
    },
    sendIfOwner() {
      if (!following) send(term.cols, term.rows);
    },
    onServerSize(cols, rows) {
      if (cols === term.cols && rows === term.rows) return; // ours, or already the same
      const own = following ? undefined : fitter.propose();
      if (own?.cols === cols && own.rows === rows) {
        fitter.fit(); // our own size, from before a reload or reconnect
        return;
      }
      setFollowing(true);
      term.resize(cols, rows);
      fitter.mirror();
    },
  };
}
