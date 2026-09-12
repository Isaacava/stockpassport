import { PublicKey, Transaction } from '@solana/web3.js';

export type WalletSigner = {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
};

type WalletProvider = WalletSigner & {
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
};

type WindowWithSolana = Window & { solana?: WalletProvider };

let connectedSigner: WalletSigner | null = null;

export function walletProvider(): WalletProvider | undefined {
  return (window as WindowWithSolana).solana;
}

export async function connectBrowserWallet(): Promise<WalletSigner> {
  const wallet = walletProvider();
  if (!wallet?.connect || !wallet.signTransaction || !wallet.signMessage) {
    throw new Error('A Solana wallet with transaction and message signing support was not found. Switch the wallet to Devnet.');
  }
  const result = await wallet.connect();
  if (result.publicKey.toBase58() !== wallet.publicKey.toBase58()) {
    throw new Error('The connected wallet did not return the expected public key.');
  }
  connectedSigner = wallet;
  return wallet;
}

export async function disconnectBrowserWallet(): Promise<void> {
  await walletProvider()?.disconnect?.();
  connectedSigner = null;
}

export function getConnectedWalletSigner(): WalletSigner {
  const wallet = connectedSigner ?? walletProvider();
  if (!wallet?.publicKey || !wallet.signTransaction || !wallet.signMessage) {
    throw new Error('Connect a wallet before signing StockPassport actions.');
  }
  connectedSigner = wallet;
  return wallet;
}

export function getConnectedWalletAddress(): string | null {
  return connectedSigner?.publicKey.toBase58() ?? walletProvider()?.publicKey?.toBase58() ?? null;
}
