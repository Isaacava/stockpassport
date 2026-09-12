import { PublicKey } from '@solana/web3.js';
import { CONNECTION } from '../config/network';
import { DEVNET_ASSETS, DEVNET_CASH_MINT, DEVNET_CASH_SYMBOL } from '../config/assets';

const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

type KnownToken = {
  symbol: string;
  assetId?: string;
};

export type TokenHolding = {
  mint: string;
  amount: string;
  decimals: number;
  symbol?: string;
  assetId?: string;
};

export async function getDevnetTokenHoldings(owner: string): Promise<TokenHolding[]> {
  const ownerKey = new PublicKey(owner);
  const response = await CONNECTION.getParsedTokenAccountsByOwner(
    ownerKey,
    { programId: SPL_TOKEN_PROGRAM_ID },
    'confirmed',
  );

  const knownByMint = new Map<string, KnownToken>();
  for (const asset of DEVNET_ASSETS) {
    if (asset.mint) knownByMint.set(asset.mint, { symbol: asset.symbol, assetId: asset.id });
  }
  if (DEVNET_CASH_MINT) {
    knownByMint.set(DEVNET_CASH_MINT, { symbol: DEVNET_CASH_SYMBOL });
  }

  return response.value
    .map(({ account }) => {
      const parsed = account.data.parsed.info;
      const mint = String(parsed.mint);
      const known = knownByMint.get(mint);
      return {
        mint,
        amount: String(parsed.tokenAmount.uiAmountString ?? parsed.tokenAmount.uiAmount ?? '0'),
        decimals: Number(parsed.tokenAmount.decimals),
        ...(known ? { symbol: known.symbol, ...(known.assetId ? { assetId: known.assetId } : {}) } : {}),
      };
    })
    .filter((holding) => holding.amount !== '0');
}
