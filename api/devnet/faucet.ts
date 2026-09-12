import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';

const RPC_URL = process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const CASH_MINT = process.env.DEVNET_CASH_MINT;
const MARKET_WALLET = process.env.DEVNET_MARKET_WALLET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAUCET_AMOUNT_UNITS = 1_000n * 1_000_000n;

function loadMarketKeypair(): Keypair {
  const raw = process.env.DEVNET_MARKET_KEYPAIR_JSON;
  if (!raw) throw new Error('DEVNET_MARKET_KEYPAIR_JSON is not configured');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (!CASH_MINT || !MARKET_WALLET) return Response.json({ error: 'Devnet faucet is not configured' }, { status: 503 });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Faucet rate limiting is not configured' }, { status: 503 });

  try {
    const body = await req.json() as { wallet?: string };
    if (!body.wallet) return Response.json({ error: 'wallet is required' }, { status: 400 });
    const user = new PublicKey(body.wallet);
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: recent, error: recentError } = await db.from('activity_events').select('created_at').eq('wallet_address', user.toBase58()).eq('event_type', 'demo_faucet').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (recentError) throw recentError;
    if (recent?.created_at && Date.now() - Date.parse(recent.created_at) < 60 * 60 * 1000) return Response.json({ error: 'Demo faucet is limited to once per hour per wallet.' }, { status: 429 });

    const market = loadMarketKeypair();
    if (market.publicKey.toBase58() !== MARKET_WALLET) throw new Error('Configured market wallet does not match its signing key');
    const connection = new Connection(RPC_URL, 'confirmed');
    const mint = new PublicKey(CASH_MINT);
    const source = await getOrCreateAssociatedTokenAccount(connection, market, mint, market.publicKey);
    const destination = await getOrCreateAssociatedTokenAccount(connection, market, mint, user);
    const tx = new Transaction().add(createTransferCheckedInstruction(source.address, mint, destination.address, market.publicKey, FAUCET_AMOUNT_UNITS, 6));
    const signature = await connection.sendTransaction(tx, [market], { preflightCommitment: 'confirmed' });
    await connection.confirmTransaction(signature, 'confirmed');

    return Response.json({ ok: true, amountUnits: FAUCET_AMOUNT_UNITS.toString(), amount: 1000, signature, marketWallet: market.publicKey.toBase58(), demoOnly: true });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : 'Faucet failed' }, { status: 400 });
  }
}
