import { PublicKey, Transaction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { CONNECTION } from '../config/network';
import { DEVNET_ASSETS, DEVNET_CASH_MINT } from '../config/assets';

export type TradeSide = 'buy' | 'sell';
export type DevnetQuote = {
  quoteId: string;
  expiresAt: string;
  assetId: string;
  referenceSymbol: string;
  referenceMainnetMint: string;
  referencePriceUsd: number;
  referencePriceChange24h: number | null;
  referenceLiquidityUsd: number | null;
  referenceBlockId: number | null;
  referenceObservedAt: string;
  referencePriceSource: 'jupiter-price-v3-mainnet';
  referenceNetwork: 'mainnet-beta';
  side: TradeSide;
  assetAmount: number;
  assetAmountUnits: string;
  executionPriceUsd: number;
  spreadBps: number;
  cashAmount: number;
  cashAmountUnits: string;
  cashDecimals: number;
  assetDecimals: number;
  cashSymbol: string;
  network: 'devnet';
  executionNetwork: 'devnet';
  marketWallet: string | null;
  demoOnly: boolean;
};
export type WalletSigner = { publicKey: PublicKey; signTransaction: (transaction: Transaction) => Promise<Transaction>; signMessage?: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }> };

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
function apiUrl(path: string): string { return `${API_BASE}${path}`; }

export async function getDevnetQuote(assetId: string, side: TradeSide, amount: number): Promise<DevnetQuote> {
  const response = await fetch(apiUrl(`/api/devnet/quote?assetId=${encodeURIComponent(assetId)}&side=${side}&amount=${encodeURIComponent(String(amount))}`), { cache: 'no-store' });
  const data = await response.json() as DevnetQuote & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Unable to get Devnet quote');
  return data;
}

function findAsset(assetId: string) {
  const asset = DEVNET_ASSETS.find((candidate) => candidate.id === assetId);
  if (!asset?.mint) throw new Error('Synthetic asset mint is not configured for this build');
  if (!DEVNET_CASH_MINT) throw new Error('Demo-USDC mint is not configured for this build');
  return { assetMint: new PublicKey(asset.mint), cashMint: new PublicKey(DEVNET_CASH_MINT), decimals: asset.decimals };
}

export async function buildDevnetPaymentTransaction(quote: DevnetQuote, signer: WalletSigner): Promise<Transaction> {
  if (!quote.marketWallet) throw new Error('Devnet market wallet is not configured');
  if (Date.parse(quote.expiresAt) <= Date.now()) throw new Error('Quote expired. Request a new quote.');
  const { assetMint, cashMint, decimals } = findAsset(quote.assetId);
  const market = new PublicKey(quote.marketWallet);
  const owner = signer.publicKey;
  const mint = quote.side === 'buy' ? cashMint : assetMint;
  const rawAmount = quote.side === 'buy' ? BigInt(quote.cashAmountUnits) : BigInt(quote.assetAmountUnits);
  const sourceAta = await getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const destinationAta = await getAssociatedTokenAddress(mint, market, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const accountInfo = await CONNECTION.getAccountInfo(sourceAta, 'confirmed');
  const transaction = new Transaction();
  if (!accountInfo) transaction.add(createAssociatedTokenAccountIdempotentInstruction(owner, sourceAta, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
  const destinationInfo = await CONNECTION.getAccountInfo(destinationAta, 'confirmed');
  if (!destinationInfo) transaction.add(createAssociatedTokenAccountIdempotentInstruction(owner, destinationAta, market, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
  transaction.add(createTransferCheckedInstruction(sourceAta, mint, destinationAta, owner, rawAmount, quote.side === 'buy' ? quote.cashDecimals : decimals));
  transaction.feePayer = owner;
  const { blockhash, lastValidBlockHeight } = await CONNECTION.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  return transaction;
}

export async function executeDevnetTrade(quote: DevnetQuote, signer: WalletSigner): Promise<{ paymentSignature: string; settlementSignature: string; marketWallet: string; reused?: boolean }> {
  const transaction = await buildDevnetPaymentTransaction(quote, signer);
  const signed = await signer.signTransaction(transaction);
  const paymentSignature = await CONNECTION.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  await CONNECTION.confirmTransaction({ signature: paymentSignature, blockhash: transaction.recentBlockhash!, lastValidBlockHeight: transaction.lastValidBlockHeight! }, 'confirmed');
  const settlementResponse = await fetch(apiUrl('/api/devnet/settle'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId: quote.quoteId, wallet: signer.publicKey.toBase58(), paymentSignature }),
  });
  const settlement = await settlementResponse.json() as { settlementSignature?: string; marketWallet?: string; reused?: boolean; error?: string };
  if (!settlementResponse.ok || !settlement.settlementSignature || !settlement.marketWallet) throw new Error(settlement.error || 'Devnet settlement failed');
  return { paymentSignature, settlementSignature: settlement.settlementSignature, marketWallet: settlement.marketWallet, reused: settlement.reused };
}
