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
  source: 'jupiter-price-v3-mainnet';
  network: 'mainnet-beta';
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function fetchMainnetReferencePrices(): Promise<MainnetReferencePrice[]> {
  const response = await fetch(apiUrl('/api/mainnet/prices'), { cache: 'no-store' });
  const data = await response.json() as { prices?: MainnetReferencePrice[]; error?: string };
  if (!response.ok || !Array.isArray(data.prices)) {
    throw new Error(data.error || 'Unable to load Mainnet reference prices.');
  }
  return data.prices;
}
