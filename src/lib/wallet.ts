import { PublicKey, Transaction } from '@solana/web3.js';

export type WalletSigner = {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
};

let connectedSigner: WalletSigner | null = null;

export function setConnectedWalletSigner(signer: WalletSigner | null): void {
  connectedSigner = signer;
}

export function getConnectedWalletSigner(): WalletSigner {
  if (!connectedSigner) {
    throw new Error('Connect a Solana wallet before signing StockPassport actions.');
  }
  return connectedSigner;
}

export function getConnectedWalletAddress(): string | null {
  return connectedSigner?.publicKey.toBase58() ?? null;
}

export function clearConnectedWalletSigner(): void {
  connectedSigner = null;
}
