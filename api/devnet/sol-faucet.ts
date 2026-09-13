import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import { loadMarketKeypair } from './keypair';

const RPC_URL = process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const MARKET_WALLET = process.env.DEVNET_MARKET_WALLET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAUCET_AMOUNT_LAMPORTS = 100_000_000n;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (!MARKET_WALLET) return Response.json({ error: 'Devnet SOL faucet is not configured' }, { status: 503 });

  try {
    const body = await req.json() as { wallet?: string };
    if (!body.wallet) return Response.json({ error: 'wallet is required' }, { status: 400 });

    const user = new PublicKey(body.wallet);
    const market = loadMarketKeypair();
    if (market.publicKey.toBase58() !== MARKET_WALLET) throw new Error('Configured market wallet does not match its signing key');
    if (user.equals(market.publicKey)) return Response.json({ error: 'Market wallet cannot claim from its own faucet.' }, { status: 400 });

    const connection = new Connection(RPC_URL, 'confirmed');
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: market.publicKey,
        toPubkey: user,
        lamports: Number(FAUCET_AMOUNT_LAMPORTS),
      }),
    );
    const signature = await connection.sendTransaction(transaction, [market], { preflightCommitment: 'confirmed' });
    await connection.confirmTransaction(signature, 'confirmed');

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await db.from('activity_events').insert({
        wallet_address: user.toBase58(),
        event_type: 'sol_faucet',
        signature,
        payload: {
          amountSol: Number(FAUCET_AMOUNT_LAMPORTS) / 1_000_000_000,
          amountLamports: FAUCET_AMOUNT_LAMPORTS.toString(),
          network: 'devnet',
          source: 'stockpassport-faucet',
        },
      });
    }

    return Response.json({
      ok: true,
      amountSol: Number(FAUCET_AMOUNT_LAMPORTS) / 1_000_000_000,
      amountLamports: FAUCET_AMOUNT_LAMPORTS.toString(),
      signature,
      network: 'devnet',
      demoOnly: true,
      unlimited: true,
    });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : 'SOL faucet failed' }, { status: 400 });
  }
}
