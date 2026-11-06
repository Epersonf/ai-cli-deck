/** A deck this one paired with: its pinned key and where it was last reached. */
export interface PeerRecord {
  id: string;
  name: string;
  /** Its Ed25519 public key, base64. Only a deck holding the matching private key can link. */
  key: string;
  /** `host:port`, most recent first. */
  addresses: string[];
  pairedAt: string;
  lastSeen: string | null;
}

export interface NetworkState {
  /** Visible on the network, accepting pairing and serving paired decks. Off unless the user turns it on. */
  sharing: boolean;
  /** The name other decks see (null: the machine's). */
  name: string | null;
  peers: PeerRecord[];
}

export interface NetworkStorePort {
  load(): Promise<NetworkState>;
  save(state: NetworkState): Promise<void>;
}

/** A pairing request shown on this deck: its code, and how the user can refuse it. */
export interface ShownCode {
  code: string;
  onCancel(listener: () => void): void;
  /** How it ended: paired, a wrong code was tried (counts against guessing), or it was given up. */
  done(outcome: 'paired' | 'wrong' | 'abandoned'): void;
}
