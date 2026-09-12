const PRICES_USD: Record<string, number> = {
  NVDA: 175,
  AAPL: 230,
  MSFT: 510,
  GOOG: 250,
};

const ASSET_TO_REFERENCE: Record<string, string> = {
  'nvda-demo': 'NVDA',
  'aapl-demo': 'AAPL',
  'msft-demo': 'MSFT',
  'goog-demo': 'GOOG',
};

const PUBLIC_CONFIG = {
  cashSymbol: 'DEMO-USDC',
  network: 'devnet',
  marketWallet: process.env.DEVNET_MARKET_WALLET ?? '',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(req.url);
  const assetId = url.searchParams.get('assetId');
  const side = url.searchParams.get('side');
  const amount = Number(url.searchParams.get('amount'));

  if (!assetId || (side !== 'buy' && side !== 'sell') || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'assetId, side and positive amount are required' }, { status: 400 });
  }

  const referenceSymbol = ASSET_TO_REFERENCE[assetId];
  if (!referenceSymbol) {
    return Response.json({ error: 'Unknown Devnet synthetic asset' }, { status: 404 });
  }

  const referencePriceUsd = PRICES_USD[referenceSymbol];
  const spreadBps = 50;
  const executionPriceUsd = side === 'buy'
    ? referencePriceUsd * (1 + spreadBps / 10_000)
    : referencePriceUsd * (1 - spreadBps / 10_000);
  const cashAmount = amount * executionPriceUsd;

  return Response.json({
    quoteId: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    assetId,
    referenceSymbol,
    side,
    assetAmount: amount,
    referencePriceUsd,
    executionPriceUsd,
    spreadBps,
    cashAmount,
    cashSymbol: PUBLIC_CONFIG.cashSymbol,
    network: PUBLIC_CONFIG.network,
    marketWallet: PUBLIC_CONFIG.marketWallet || null,
    demoOnly: true,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
