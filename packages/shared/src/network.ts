import { z } from 'zod';

/** Path under which a deck shows a paired deck's whole app: `/peer/<id>/`. */
export const PEER_PATH = '/peer';
/** TCP port a sharing deck accepts pairing and links on (`DECK_PEER_PORT`). */
export const DEFAULT_PEER_PORT = 7850;
/** UDP port sharing decks answer "who is there?" on, so others can list them. */
export const DISCOVERY_PORT = 7849;
/** Digits in a pairing code. */
export const PAIR_CODE_LENGTH = 6;

export const DeckNameSchema = z.string().trim().min(1).max(40);

export const NetworkStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** This deck is visible on the network, accepts pairing and serves its paired decks. */
  sharing: z.boolean(),
  /** The port it listens on while sharing. */
  port: z.number().nullable(),
  /** This machine's network addresses (to pair by address, e.g. over a VPN). */
  addresses: z.array(z.string()),
  /** Why sharing could not start (port taken...). */
  error: z.string().nullable(),
});
export type NetworkStatus = z.infer<typeof NetworkStatusSchema>;

export const NetworkSettingsBodySchema = z.object({
  sharing: z.boolean().optional(),
  name: DeckNameSchema.optional(),
});
export type NetworkSettingsBody = z.infer<typeof NetworkSettingsBodySchema>;

export const PeerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Where it was reached, most recent first (`host:port`). */
  addresses: z.array(z.string()),
  pairedAt: z.string(),
  lastSeen: z.string().nullable(),
  /** A link to it is open right now. */
  online: z.boolean(),
});
export type PeerInfo = z.infer<typeof PeerInfoSchema>;

export const NearbyDeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  paired: z.boolean(),
});
export type NearbyDeck = z.infer<typeof NearbyDeckSchema>;

/** `host:port`, or a bare host (the default peer port is used). */
export const PeerAddressSchema = z.string().trim().min(1).max(200);

export const PairStartBodySchema = z.object({ address: PeerAddressSchema });
export const PairStartSchema = z.object({ pairingId: z.string(), name: z.string() });
export type PairStart = z.infer<typeof PairStartSchema>;

export const PairCodeBodySchema = z.object({
  code: z.string().regex(new RegExp(`^[0-9]{${PAIR_CODE_LENGTH}}$`)),
});
/** Paired (the new peer), or a wrong code with `left` tries. */
export const PairResultSchema = z.object({
  peer: PeerInfoSchema.nullable(),
  left: z.number().nullable(),
});
export type PairResult = z.infer<typeof PairResultSchema>;

/** A deck asking to pair with this one: the code to type there. */
export const PairingRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  expiresAt: z.string(),
});
export type PairingRequest = z.infer<typeof PairingRequestSchema>;

export const PeerAddressBodySchema = z.object({ address: PeerAddressSchema });

/** `host:port` split, with IPv6 in brackets; null when it is not an address. */
export function parsePeerAddress(
  text: string,
  defaultPort: number,
): { host: string; port: number } | null {
  const match = /^(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(text.trim());
  if (!match?.[1]) return null;
  const port = match[2] === undefined ? defaultPort : Number(match[2]);
  if (port < 1 || port > 65535) return null;
  return { host: match[1], port };
}
