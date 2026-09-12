import { createHmac } from 'node:crypto';
import { getMainnetPrice } from '../mainnet/prices';

const QUOTE_SIGNING_SECRET = process.env.QUOTE_SIGNING_SECRET;

function toUnits(value: number, decimals: number): string {
  return String(Math.round(value * 10 ** decimals));
}

function signQuote(input: { quoteId: string; assetId: string; side: string; assetAmountUnits: string; cashAmountUnits: string; expiresAt: string }): string {
  if (!QUOTE_SIGNING_SECRET) throw new Error('QUOTE_SIGNING_SECRET is not configured');
  const payload = [input.quoteId, input.assetId, input.side, input.assetAmountUnits, input.cashAmountUnits, input.expiresAt].join('|');
  return createHmac('sha256', QUOTE_SIGNING_SECRET).update(payload).digest('hex');
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

  try {
    const reference = await getMainnetPrice(assetId);
    const spreadBps = 50;
    const executionPriceUsd = side === 'buy'
      ? reference.priceUsd * (1 + spreadBps / 10_000)
      : reference.priceUsd * (1 - spreadBps / 10_000);
    const assetAmountUnits = toUnits(amount, 6);
    const cashAmount = amount * executionPriceUsd;
    const cashAmountUnits = toUnits(cashAmount, 6);
    const quoteId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30_000).toISOString();
    const quoteSignature = signQuote({ quoteId, assetId, side, assetAmountUnits, cashAmountUnits, expiresAt });

    return Response.json({
      quoteId,
      quoteSignature,
      expiresAt,
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
      assetAmountUnits,
      executionPriceUsd,
      spreadBps,
      cashAmount,
      cashAmountUnits,
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
