export type MainnetPrice = {
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

type JupiterPriceRecord = {
  usdPrice?: number;
  priceChange24h?: number;
  liquidity?: number;
  blockId?: number;
};

const ASSETS = {
  'nvda-demo': {
    demoSymbol: 'NVDAx-DEMO',
    referenceSymbol: 'NVDA',
    mainnetMint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
  },
  'aapl-demo': {
    demoSymbol: 'AAPLx-DEMO',
    referenceSymbol: 'AAPL',
    mainnetMint: 'XsbEhLAtcf6HdfpZ5xEMdqW8nfAvcsP5bdudRLJzJp',
  },
  'msft-demo': {
    demoSymbol: 'MSFTx-DEMO',
    referenceSymbol: 'MSFT',
    mainnetMint: 'XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX',
  },
  'goog-demo': {
    demoSymbol: 'GOOGx-DEMO',
    referenceSymbol: 'GOOGL',
    mainnetMint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN',
  },
} as const;

const PRICE_URL = process.env.MAINNET_PRICE_API_URL || 'https://api.jup.ag/price/v3';
const API_KEY = process.env.JUPITER_API_KEY;
const CACHE_MS = 10_000;
let cache: { expiresAt: number; prices: MainnetPrice[] } | null = null;

async function fetchPrices(): Promise<MainnetPrice[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.prices;

  const ids = Object.values(ASSETS).map((asset) => asset.mainnetMint).join(',');
  const response = await fetch(`${PRICE_URL}?ids=${encodeURIComponent(ids)}`, {
    headers: API_KEY ? { 'x-api-key': API_KEY, accept: 'application/json' } : { accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Mainnet price source returned HTTP ${response.status}.`);
  }

  const payload = await response.json() as Record<string, JupiterPriceRecord>;
  const observedAt = new Date().toISOString();
  const prices = Object.entries(ASSETS).map(([assetId, asset]) => {
    const record = payload[asset.mainnetMint];
    const priceUsd = Number(record?.usdPrice);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      throw new Error(`No reliable Mainnet price is available for ${asset.demoSymbol}.`);
    }
    return {
      assetId,
      demoSymbol: asset.demoSymbol,
      referenceSymbol: asset.referenceSymbol,
      mainnetMint: asset.mainnetMint,
      priceUsd,
      priceChange24h: Number.isFinite(Number(record?.priceChange24h)) ? Number(record?.priceChange24h) : null,
      liquidityUsd: Number.isFinite(Number(record?.liquidity)) ? Number(record?.liquidity) : null,
      blockId: Number.isFinite(Number(record?.blockId)) ? Number(record?.blockId) : null,
      observedAt,
      source: 'jupiter-price-v3-mainnet',
      network: 'mainnet-beta',
    } satisfies MainnetPrice;
  });

  cache = { expiresAt: Date.now() + CACHE_MS, prices };
  return prices;
}

export async function loadMainnetPrices(): Promise<MainnetPrice[]> {
  return fetchPrices();
}

export async function getMainnetPrice(assetId: string): Promise<MainnetPrice> {
  const price = (await fetchPrices()).find((item) => item.assetId === assetId);
  if (!price) throw new Error('Unknown synthetic asset for Mainnet pricing.');
  return price;
}

export function getMainnetAssetConfig() {
  return ASSETS;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const prices = await loadMainnetPrices();
    return Response.json({
      network: 'mainnet-beta',
      source: 'Jupiter Price API V3',
      prices,
      fetchedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : 'Unable to fetch Mainnet prices' }, { status: 502 });
  }
}
