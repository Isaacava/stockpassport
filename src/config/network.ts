import { clusterApiUrl, Connection } from '@solana/web3.js';

export const NETWORK = 'devnet' as const;
export const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(NETWORK);
export const CONNECTION = new Connection(RPC_URL, 'confirmed');
export const EXPLORER_CLUSTER = 'devnet';
export const EXPLORER_BASE = 'https://explorer.solana.com';

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}?cluster=${EXPLORER_CLUSTER}`;
}

export function explorerTxUrl(signature: string): string {
  return `${EXPLORER_BASE}/tx/${signature}?cluster=${EXPLORER_CLUSTER}`;
}
