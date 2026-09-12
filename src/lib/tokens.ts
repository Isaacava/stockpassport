import { PublicKey } from '@solana/web3.js';
import { CONNECTION } from '../config/network';
import { DEVNET_ASSETS } from '../config/assets';

const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

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

  const knownByMint = new Map(
    DEVNET_ASSETS.filter((asset) => asset.mint).map((asset) => [asset.mint!, asset]),
  );

  return response.value
    .map(({ account }) => {
      const parsed = account.data.parsed.info;
      const mint = String(parsed.mint);
      const known = knownByMint.get(mint);
      return {
        mint,
        amount: String(parsed.tokenAmount.uiAmountString ?? parsed.tokenAmount.uiAmount ?? '0'),
        decimals: Number(parsed.tokenAmount.decimals),
        ...(known ? { symbol: known.symbol, assetId: known.id } : {}),
      };
    })
    .filter((holding) => holding.amount !== '0');
}
