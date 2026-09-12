import { getMainnetPrice } from '../mainnet/prices';

function toUnits(value: number, decimals: number): string {
  return String(Math.round(value * 10 ** decimals));
}

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

  if (assetId === 'goog-demo') {
    // The demo keeps its historical GOOG label, while the Mainnet xStock reference
    // is GOOGLx (Alphabet Class A). This mapping is intentionally explicit.
  }

  try {
    const reference = await getMainnetPrice(assetId);
    const spreadBps = 50;
    const executionPriceUsd = side === 'buy'
      ? reference.priceUsd * (1 + spreadBps / 10_000)
      : reference.priceUsd * (1 - spreadBps / 10_000);
    const cashAmount = amount * executionPriceUsd;

    return Response.json({
      quoteId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      assetId,
      referenceSymbol: reference.referenceSymbol,
      referenceMainnetMint: reference.mainnetMint,
      referencePriceUsd: reference.priceUsd,
      referencePriceChange24h: reference.priceChange24h,
      referenceLiquidityUsd: reference.liquidityUsd,
      referenceBlockId: reference.blockId,
      referenceObservedAt: reference.observedAt,
      referencePriceSource: reference.source,
      referenceNetwork: reference.network,
      side,
      assetAmount: amount,
      assetAmountUnits: toUnits(amount, 6),
      executionPriceUsd,
      spreadBps,
      cashAmount,
      cashAmountUnits: toUnits(cashAmount, 6),
      cashDecimals: 6,
      assetDecimals: 6,
      cashSymbol: 'DEMO-USDC',
      network: 'devnet',
      executionNetwork: 'devnet',
      marketWallet: process.env.DEVNET_MARKET_WALLET ?? null,
      demoOnly: true,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : 'Unable to obtain a reliable Mainnet reference price' }, { status: 502 });
  }
}
