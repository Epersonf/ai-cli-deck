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

/**
 * One terminal, several devices (say a phone and a PC): the program has a single size, so the last device
 * you used sets it and the others show it as it is (scrolling if it does not fit) instead of garbling the
 * screen. Using a mirroring device (typing, tapping, focusing it) takes the size over.
 */
export function createSizeSync(
  term: SizedTerminal,
  fitter: { fit(): void },
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
      if (!following) fitter.fit();
    },
    sendIfOwner() {
      if (!following) send(term.cols, term.rows);
    },
    onServerSize(cols, rows) {
      if (cols === term.cols && rows === term.rows) return; // ours, or already the same
      setFollowing(true);
      term.resize(cols, rows);
    },
  };
}
