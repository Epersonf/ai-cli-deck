import {
  NearbyDeckSchema,
  NetworkStatusSchema,
  PairingRequestSchema,
  PairResultSchema,
  PairStartSchema,
  PeerInfoSchema,
  type NetworkSettingsBody,
} from '@deck/shared';
import { z } from 'zod';
import { requestHere as request } from './client';

const enc = encodeURIComponent;
const none = z.void();

/** Sharing, pairing and paired decks: always this deck's (the one serving the page). */
export const networkApi = {
  status: () => request(NetworkStatusSchema, 'GET', '/api/network'),
  update: (body: NetworkSettingsBody) =>
    request(NetworkStatusSchema, 'PATCH', '/api/network', body),
  peers: () => request(z.array(PeerInfoSchema), 'GET', '/api/network/peers'),
  forget: (id: string) => request(none, 'DELETE', `/api/network/peers/${enc(id)}`),
  addAddress: (id: string, address: string) =>
    request(none, 'POST', `/api/network/peers/${enc(id)}/addresses`, { address }),
  nearby: () => request(z.array(NearbyDeckSchema), 'GET', '/api/network/nearby'),
  pair: (address: string) => request(PairStartSchema, 'POST', '/api/network/pair', { address }),
  submit: (pairingId: string, code: string) =>
    request(PairResultSchema, 'POST', `/api/network/pair/${enc(pairingId)}`, { code }),
  cancel: (pairingId: string) => request(none, 'DELETE', `/api/network/pair/${enc(pairingId)}`),
  requests: () => request(z.array(PairingRequestSchema), 'GET', '/api/network/requests'),
  refuse: (id: string) => request(none, 'DELETE', `/api/network/requests/${enc(id)}`),
};

/** Opens a paired deck's app (it replaces this page; the banner there leads back). */
export const openPeer = (id: string): void => window.location.assign(`/peer/${enc(id)}/`);
