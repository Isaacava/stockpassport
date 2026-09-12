import { createPublicKey, verify } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_WINDOW_MS = 2 * 60 * 1000;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function requireWallet(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('wallet is required');
  const wallet = value.trim();
  new PublicKey(wallet);
  return wallet;
}

function getDb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase server configuration is missing');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function verifyMutationSignature(req: Request, wallet: string, body: string): void {
  const timestamp = req.headers.get('x-sp-auth-timestamp');
  const message = req.headers.get('x-sp-auth-message');
  const signatureB64 = req.headers.get('x-sp-auth-signature');
  if (!timestamp || !message || !signatureB64) throw new Error('Wallet signature authorization is required for this mutation');
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > AUTH_WINDOW_MS) throw new Error('Wallet authorization has expired');

  const expectedMessage = `StockPassport authorization\n${wallet}\n${timestamp}\n${req.method}\n/api/data\n${body}`;
  if (message !== expectedMessage) throw new Error('Wallet authorization message does not match the request');

  let signature: Buffer;
  try { signature = Buffer.from(signatureB64, 'base64'); } catch { throw new Error('Invalid wallet signature encoding'); }
  const publicKeyDer = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), new PublicKey(wallet).toBytes()]);
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (!verify(null, Buffer.from(message, 'utf8'), publicKey, signature)) throw new Error('Wallet signature verification failed');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const db = getDb();

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const wallet = requireWallet(url.searchParams.get('wallet'));
      const [portfolioResult, activityResult, tradesResult] = await Promise.all([
        db.from('portfolios').select('id,name,description,network,wallet_address,created_at,updated_at').eq('wallet_address', wallet).order('created_at', { ascending: true }),
        db.from('activity_events').select('id,event_type,network,signature,payload,created_at').eq('wallet_address', wallet).order('created_at', { ascending: false }).limit(100),
        db.from('trade_intents').select('id,quote_id,asset_id,side,asset_amount_units,cash_amount_units,status,payment_signature,settlement_signature,error_message,created_at,updated_at').eq('wallet_address', wallet).order('created_at', { ascending: false }).limit(100),
      ]);
      if (portfolioResult.error) throw portfolioResult.error;
      if (activityResult.error) throw activityResult.error;
      if (tradesResult.error) throw tradesResult.error;

      const portfolios = portfolioResult.data ?? [];
      let portfolio = portfolios[0] ?? null;
      if (!portfolio) {
        const created = await db.from('portfolios').insert({ wallet_address: wallet, user_id: null, name: 'My Portfolio', description: 'Default StockPassport portfolio', network: 'devnet' }).select('id,name,description,network,wallet_address,created_at,updated_at').single();
        if (created.error) throw created.error;
        portfolio = created.data;
      }

      const [rulesResult, proposalsResult] = await Promise.all([
        db.from('portfolio_rules').select('id,portfolio_id,rule_type,enabled,parameters,created_at,updated_at').eq('portfolio_id', portfolio.id).order('created_at', { ascending: true }),
        db.from('rule_proposals').select('id,portfolio_id,wallet_address,chain_snapshot,proposal,status,created_at,expires_at').eq('portfolio_id', portfolio.id).eq('wallet_address', wallet).order('created_at', { ascending: false }).limit(100),
      ]);
      if (rulesResult.error) throw rulesResult.error;
      if (proposalsResult.error) throw proposalsResult.error;

      return json({ portfolio, portfolios, rules: rulesResult.data ?? [], proposals: proposalsResult.data ?? [], activities: activityResult.data ?? [], trades: tradesResult.data ?? [] });
    }

    const rawBody = await req.text();
    const body = JSON.parse(rawBody) as { action?: string; wallet?: string; [key: string]: unknown };
    const wallet = requireWallet(body.wallet);
    const protectedMutation = body.action === 'savePortfolio' || body.action === 'saveRule';
    if (protectedMutation) verifyMutationSignature(req, wallet, rawBody);

    if (body.action === 'savePortfolio') {
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'My Portfolio';
      const description = typeof body.description === 'string' ? body.description.trim() : null;
      const id = typeof body.id === 'string' && body.id ? body.id : undefined;
      const result = id
        ? await db.from('portfolios').update({ name, description, wallet_address: wallet }).eq('id', id).eq('wallet_address', wallet).select('id,name,description,network,wallet_address,created_at,updated_at').single()
        : await db.from('portfolios').insert({ wallet_address: wallet, user_id: null, name, description, network: 'devnet' }).select('id,name,description,network,wallet_address,created_at,updated_at').single();
      if (result.error) throw result.error;
      return json({ portfolio: result.data });
    }

    if (body.action === 'saveRule') {
      if (typeof body.portfolioId !== 'string' || typeof body.ruleType !== 'string') throw new Error('portfolioId and ruleType are required');
      const portfolio = await db.from('portfolios').select('id').eq('id', body.portfolioId).eq('wallet_address', wallet).single();
      if (portfolio.error) throw portfolio.error;
      const parameters = body.parameters && typeof body.parameters === 'object' ? body.parameters : {};
      const result = await db.from('portfolio_rules').upsert({ id: typeof body.id === 'string' ? body.id : undefined, portfolio_id: body.portfolioId, rule_type: body.ruleType, enabled: body.enabled !== false, parameters }, { onConflict: 'id' }).select('id,portfolio_id,rule_type,enabled,parameters,created_at,updated_at').single();
      if (result.error) throw result.error;
      return json({ rule: result.data });
    }

    if (body.action === 'recordRuleProposal') {
      if (typeof body.portfolioId !== 'string') throw new Error('portfolioId is required');
      const proposal = body.proposal && typeof body.proposal === 'object' ? body.proposal : {};
      const chainSnapshot = body.chainSnapshot && typeof body.chainSnapshot === 'object' ? body.chainSnapshot : {};
      const status = body.status === 'authorized' || body.status === 'executed' || body.status === 'expired' || body.status === 'rejected' ? body.status : 'proposed';
      const result = await db.from('rule_proposals').insert({ portfolio_id: body.portfolioId, wallet_address: wallet, chain_snapshot: chainSnapshot, proposal, status, expires_at: typeof body.expiresAt === 'string' ? body.expiresAt : null }).select('id,portfolio_id,wallet_address,chain_snapshot,proposal,status,created_at,expires_at').single();
      if (result.error) throw result.error;
      return json({ proposal: result.data });
    }

    if (body.action === 'recordActivity') {
      const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
      const result = await db.from('activity_events').insert({ wallet_address: wallet, user_id: null, event_type: typeof body.eventType === 'string' ? body.eventType : 'activity', network: 'devnet', signature: typeof body.signature === 'string' ? body.signature : null, payload }).select('id,event_type,network,signature,payload,created_at').single();
      if (result.error) throw result.error;

      if (body.eventType === 'rule_proposal_executed' && typeof payload.proposalId === 'string') {
        const portfolioResult = await db.from('portfolios').select('id').eq('wallet_address', wallet).order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (!portfolioResult.error && portfolioResult.data) {
          const existing = await db.from('rule_proposals').select('id').eq('portfolio_id', portfolioResult.data.id).eq('wallet_address', wallet).contains('proposal', { sourceProposalId: payload.proposalId }).limit(1).maybeSingle();
          if (!existing.error && !existing.data) {
            await db.from('rule_proposals').insert({
              portfolio_id: portfolioResult.data.id,
              wallet_address: wallet,
              chain_snapshot: { totalValueUsd: payload.totalValueUsd ?? null, cashPct: payload.cashPct ?? null, referencePriceSource: payload.referencePriceSource ?? null, referenceObservedAt: payload.referenceObservedAt ?? null },
              proposal: { sourceProposalId: payload.proposalId, kind: payload.kind ?? null, assetId: payload.assetId ?? null, targetPct: payload.targetPct ?? null, valueUsd: payload.valueUsd ?? null, settlementSignature: typeof body.signature === 'string' ? body.signature : null },
              status: 'executed',
            });
          }
        }
      }
      return json({ activity: result.data });
    }

    if (body.action === 'recordTradeIntent') {
      const required = ['quoteId', 'assetId', 'side', 'assetAmountUnits', 'cashAmountUnits'];
      for (const key of required) if (typeof body[key] !== 'string') throw new Error(`${key} is required`);
      const result = await db.from('trade_intents').upsert({ wallet_address: wallet, user_id: null, quote_id: body.quoteId, asset_id: body.assetId, side: body.side, asset_amount_units: body.assetAmountUnits, cash_amount_units: body.cashAmountUnits, status: typeof body.status === 'string' ? body.status : 'created', payment_signature: typeof body.paymentSignature === 'string' ? body.paymentSignature : null, settlement_signature: typeof body.settlementSignature === 'string' ? body.settlementSignature : null, error_message: typeof body.errorMessage === 'string' ? body.errorMessage : null }, { onConflict: 'quote_id,wallet_address' }).select('id,quote_id,asset_id,side,asset_amount_units,cash_amount_units,status,payment_signature,settlement_signature,error_message,created_at,updated_at').single();
      if (result.error) throw result.error;
      return json({ trade: result.data });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Database request failed' }, 400);
  }
}
