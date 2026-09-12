import { PublicKey, Transaction } from '@solana/web3.js';

export type WalletSigner = {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
};

let connectedSigner: WalletSigner | null = null;
let disconnectWallet: (() => Promise<void>) | null = null;

export function setConnectedWalletSigner(signer: WalletSigner | null): void {
  connectedSigner = signer;
}

export function setWalletDisconnect(handler: (() => Promise<void>) | null): void {
  disconnectWallet = handler;
}

export async function connectBrowserWallet(): Promise<WalletSigner> {
  if (!connectedSigner) {
    throw new Error('Connect a Solana wallet with WalletConnect before entering the portfolio.');
  }
  return connectedSigner;
}

export async function disconnectBrowserWallet(): Promise<void> {
  if (disconnectWallet) await disconnectWallet();
  connectedSigner = null;
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

export function createReownWalletSigner(address: string, provider: {
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}): WalletSigner {
  const publicKey = new PublicKey(address);
  return {
    publicKey,
    signTransaction: (transaction) => provider.signTransaction(transaction),
    signMessage: (message) => provider.signMessage(message),
  };
}
