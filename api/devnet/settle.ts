import { createHmac, timingSafeEqual } from 'node:crypto';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';
import { loadMarketKeypair } from './keypair';

const ASSET_MINT_ENV: Record<string, string> = { 'nvda-demo': 'DEVNET_NVDA_MINT', 'aapl-demo': 'DEVNET_AAPL_MINT', 'msft-demo': 'DEVNET_MSFT_MINT', 'goog-demo': 'DEVNET_GOOG_MINT' };
const RPC_URL = process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const CASH_MINT = process.env.DEVNET_CASH_MINT;
const MARKET_WALLET = process.env.DEVNET_MARKET_WALLET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QUOTE_SIGNING_SECRET = process.env.QUOTE_SIGNING_SECRET;

function parseUnits(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Invalid decimal amount');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error('Amount has too many decimal places');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
}
function signQuote(input: { quoteId: string; assetId: string; side: string; assetAmountUnits: string; cashAmountUnits: string; expiresAt: string }): string {
  if (!QUOTE_SIGNING_SECRET) throw new Error('QUOTE_SIGNING_SECRET is not configured');
  const payload = [input.quoteId, input.assetId, input.side, input.assetAmountUnits, input.cashAmountUnits, input.expiresAt].join('|');
  return createHmac('sha256', QUOTE_SIGNING_SECRET).update(payload).digest('hex');
}
function verifyQuoteSignature(input: Parameters<typeof signQuote>[0], provided: string): boolean {
  const expected = signQuote(input);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
function extractOwnerDelta(transaction: any, mint: string, owner: string): bigint {
  const pre = (transaction.meta?.preTokenBalances ?? []).filter((b: any) => b.mint === mint && b.owner === owner);
  const post = (transaction.meta?.postTokenBalances ?? []).filter((b: any) => b.mint === mint && b.owner === owner);
  const sum = (balances: any[]) => balances.reduce((total, b) => total + BigInt(b.uiTokenAmount.amount), 0n);
  return sum(post) - sum(pre);
}
async function confirmPayment(connection: Connection, signature: string, expectedMint: string, user: string, expectedSourceDelta: bigint, expectedMarketDelta: bigint) {
  const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
  if (!status.value?.confirmationStatus || status.value.err) throw new Error('Payment transaction is not confirmed successfully');
  const tx = await connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx || tx.meta?.err) throw new Error('Unable to inspect the confirmed payment transaction');
  const sourceDelta = extractOwnerDelta(tx, expectedMint, user);
  const marketDelta = extractOwnerDelta(tx, expectedMint, MARKET_WALLET!);
  if (sourceDelta !== expectedSourceDelta || marketDelta !== expectedMarketDelta) throw new Error('Payment transaction does not match the requested settlement amount and destination');
}
async function transferFromMarket(connection: Connection, market: import('@solana/web3.js').Keypair, mint: PublicKey, destinationOwner: PublicKey, rawAmount: bigint, decimals: number): Promise<string> {
  const destination = await getOrCreateAssociatedTokenAccount(connection, market, mint, destinationOwner);
  const source = await getAssociatedTokenAddress(mint, market.publicKey);
  await getAccount(connection, source);
  const tx = new Transaction().add(createTransferCheckedInstruction(source, mint, destination.address, market.publicKey, rawAmount, decimals));
  const signature = await connection.sendTransaction(tx, [market], { preflightCommitment: 'confirmed' });
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (!CASH_MINT || !MARKET_WALLET) return Response.json({ error: 'Devnet market is not configured' }, { status: 503 });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Settlement persistence is not configured' }, { status: 503 });
  if (!QUOTE_SIGNING_SECRET) return Response.json({ error: 'Quote signing is not configured' }, { status: 503 });

  try {
    const body = await req.json() as { quoteId?: string; quoteSignature?: string; side?: 'buy' | 'sell'; assetId?: string; wallet?: string; paymentSignature?: string; assetAmount?: string; assetAmountUnits?: string; cashAmountUnits?: string; expiresAt?: string };
    if (!body.quoteId || !body.quoteSignature || !body.side || !body.assetId || !body.wallet || !body.paymentSignature || !body.assetAmount || !body.assetAmountUnits || !body.cashAmountUnits || !body.expiresAt) return Response.json({ error: 'Missing settlement fields' }, { status: 400 });
    if (Date.parse(body.expiresAt) <= Date.now()) return Response.json({ error: 'Quote expired' }, { status: 400 });

    const expectedAssetRaw = parseUnits(body.assetAmount, 6);
    if (expectedAssetRaw.toString() !== body.assetAmountUnits) throw new Error('Asset amount units do not match the quoted amount');
    if (!verifyQuoteSignature({ quoteId: body.quoteId, assetId: body.assetId, side: body.side, assetAmountUnits: body.assetAmountUnits, cashAmountUnits: body.cashAmountUnits, expiresAt: body.expiresAt }, body.quoteSignature)) throw new Error('Quote signature is invalid or was modified');

    const envName = ASSET_MINT_ENV[body.assetId];
    const stockMintValue = envName ? process.env[envName] : undefined;
    if (!stockMintValue) return Response.json({ error: 'Synthetic asset mint is not configured' }, { status: 503 });

    const user = new PublicKey(body.wallet);
    const market = loadMarketKeypair();
    if (market.publicKey.toBase58() !== MARKET_WALLET) throw new Error('Configured market wallet does not match its signing key');
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const cashRaw = BigInt(body.cashAmountUnits);
    const assetRaw = expectedAssetRaw;
    const existingTrade = await db.from('trade_intents').select('id,status,payment_signature,settlement_signature').eq('quote_id', body.quoteId).eq('wallet_address', user.toBase58()).maybeSingle();
    if (existingTrade.error) throw existingTrade.error;
    if (existingTrade.data?.status === 'settled' && existingTrade.data.settlement_signature) return Response.json({ ok: true, reused: true, side: body.side, assetId: body.assetId, paymentSignature: existingTrade.data.payment_signature, settlementSignature: existingTrade.data.settlement_signature, marketWallet: market.publicKey.toBase58() });
    if (!existingTrade.data) {
      const created = await db.from('trade_intents').insert({ user_id: null, wallet_address: user.toBase58(), quote_id: body.quoteId, asset_id: body.assetId, side: body.side, asset_amount_units: assetRaw.toString(), cash_amount_units: cashRaw.toString(), status: 'payment_confirmed', payment_signature: body.paymentSignature });
      if (created.error) throw created.error;
    }

    const lock = await db.from('trade_intents').update({ status: 'settlement_pending', payment_signature: body.paymentSignature }).eq('quote_id', body.quoteId).eq('wallet_address', user.toBase58()).in('status', ['created', 'payment_pending', 'payment_confirmed']).select('id').maybeSingle();
    if (!lock.data) {
      const current = await db.from('trade_intents').select('status,settlement_signature,payment_signature').eq('quote_id', body.quoteId).eq('wallet_address', user.toBase58()).maybeSingle();
      if (current.data?.status === 'settled' && current.data.settlement_signature) return Response.json({ ok: true, reused: true, side: body.side, assetId: body.assetId, paymentSignature: current.data.payment_signature, settlementSignature: current.data.settlement_signature, marketWallet: market.publicKey.toBase58() });
      return Response.json({ error: 'Settlement is already in progress for this quote.' }, { status: 409 });
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const stockMint = new PublicKey(stockMintValue);
    const cashMint = new PublicKey(CASH_MINT);
    let settlementSignature: string;
    if (body.side === 'buy') {
      await confirmPayment(connection, body.paymentSignature, CASH_MINT, body.wallet, -cashRaw, cashRaw);
      settlementSignature = await transferFromMarket(connection, market, stockMint, user, assetRaw, 6);
    } else {
      await confirmPayment(connection, body.paymentSignature, stockMintValue, body.wallet, -assetRaw, assetRaw);
      settlementSignature = await transferFromMarket(connection, market, cashMint, user, cashRaw, 6);
    }

    await db.from('trade_intents').update({ status: 'settled', payment_signature: body.paymentSignature, settlement_signature: settlementSignature, error_message: null }).eq('quote_id', body.quoteId).eq('wallet_address', user.toBase58());
    return Response.json({ ok: true, reused: false, side: body.side, assetId: body.assetId, paymentSignature: body.paymentSignature, settlementSignature, marketWallet: market.publicKey.toBase58() });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : 'Settlement failed' }, { status: 400 });
  }
}
