import { fetchJson } from './api';

export type MainnetReferencePriceSource = 'jupiter-price-v3-mainnet' | 'xstocks-public-price-api';

export type MainnetReferencePrice = {
  assetId: string;
  demoSymbol: string;
  referenceSymbol: string;
  mainnetMint: string;
  priceUsd: number;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  blockId: number | null;
  observedAt: string;
  source: MainnetReferencePriceSource;
  network: 'mainnet-beta';
};

type MainnetPriceResponse = {
  network: 'mainnet-beta';
  source: string;
  prices: MainnetReferencePrice[];
  fetchedAt: string;
};

export async function fetchMainnetReferencePrices(): Promise<MainnetReferencePrice[]> {
  const data = await fetchJson<MainnetPriceResponse>('/api/mainnet/prices');
  if (!Array.isArray(data.prices)) throw new Error('Mainnet reference service returned no prices.');
  return data.prices;
}
