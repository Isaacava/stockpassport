import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';

export const DEVNET_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet');
export const DEVNET_CONNECTION = new Connection(DEVNET_RPC_URL, 'confirmed');

export function isSolanaAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export async function getDevnetBalance(address: string): Promise<number> {
  const publicKey = new PublicKey(address);
  const lamports = await DEVNET_CONNECTION.getBalance(publicKey, 'confirmed');
  return lamports / 1_000_000_000;
}

export async function getLatestBlockhash() {
  return DEVNET_CONNECTION.getLatestBlockhash('confirmed');
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
